import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda-nodejs';
import * as iam from '@aws-cdk/aws-iam';
import { Auth } from '../common/auth';
import { PostsService } from '../postsService/posts-service';
import * as assets from '@aws-cdk/aws-s3-assets';
import * as sfn from '@aws-cdk/aws-stepfunctions';
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks';
import * as path from 'path';

const DEFAULT_PASSWORD = 'Password1/';

interface LoadtestingProps {
  userAuth: Auth
  postService: PostsService
}

export class Loadtesting extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: LoadtestingProps) {
    super(scope, id);

    //Deploy unicorn pic to be uploaded by virtual users
    const unicornPic = new assets.Asset(this, 'UnicornPic', {
      path: path.resolve(__dirname, 'unicorn.png'),
    });

    //Role for lambdas that need to create/delete Cognito users
    const lambdaCognitoPowerUserRole = new iam.Role(this, 'createUserRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: "createUserRole"
    });
    lambdaCognitoPowerUserRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    lambdaCognitoPowerUserRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonCognitoPowerUser"));

    //Create lambda function - Create User Ids
    const createUserIds = new lambda.NodejsFunction(this, 'createUserIds');

    //Create lambda function - Create User
    const createUsers = new lambda.NodejsFunction(this, 'createUsers', {
      environment: {
        CLIENT_ID: props.userAuth.userPoolClient.userPoolClientId,
        DEFAULT_PASSWORD: DEFAULT_PASSWORD,
      },
      role: lambdaCognitoPowerUserRole,
      timeout: cdk.Duration.minutes(5),
    });

    //Create lambda function - Trigger Load Test
    const triggerLoadTestRole = new iam.Role(this, 'triggerLoadTestRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: "TriggerLoadTestRole"
    });
    triggerLoadTestRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    triggerLoadTestRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonCognitoPowerUser"));
    triggerLoadTestRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject", "s3:GetObjectVersion"],
      resources: [unicornPic.bucket.arnForObjects(unicornPic.s3ObjectKey)],
    }));

    const triggerLoadTest = new lambda.NodejsFunction(this, 'triggerLoadTest', {
      environment: {
        USER_POOL_ID: props.userAuth.userPool.userPoolId,
        CLIENT_ID: props.userAuth.userPoolClient.userPoolClientId,
        API_URL: props.postService.postsApi.url,
        PICTURE_BUCKET: unicornPic.s3BucketName,
        PICTURE_KEY: unicornPic.s3ObjectKey,
        DEFAULT_PASSWORD: DEFAULT_PASSWORD,
      },
      role: triggerLoadTestRole,
      timeout: cdk.Duration.minutes(5),
    });

    //StepFunction to coordination load testing steps
    const inputValidationFailed = new sfn.Fail(this, 'Input Validation Failed', {
      cause: 'Input Validation Failed. Please ensure NumberOfUser & NumberOfLikesPerUser do not exceed limits.',
      error: "NumberOfUsers > 1000 OR NumberOfLikesPerUser > 1000",
    });
    const testComplete = new sfn.Pass(this, 'Test Complete');
    const createTestUserIdsTask = new tasks.LambdaInvoke(this, 'Create User Ids', {
      lambdaFunction: createUserIds,
      inputPath: '$.users',
      outputPath: '$.Payload.userNames',
    });
    const createTestUsersTask = new tasks.LambdaInvoke(this, 'Create Users', {
      lambdaFunction: createUsers,
      resultPath: sfn.JsonPath.DISCARD,
    });
    const triggerLoadTask = new tasks.LambdaInvoke(this, 'Trigger Load', {
      lambdaFunction: triggerLoadTest,
      retryOnServiceExceptions: true,
    });
    const triggerAllLoadTask = new sfn.Map(this, 'Trigger All Load', {
      maxConcurrency: 0,
    }).iterator(triggerLoadTask);

    const loadtestDefinition = new sfn.Choice(this, 'Check Input Params')
      .when(sfn.Condition.numberGreaterThan('$.users.NumberOfUsers', 1000), inputValidationFailed)
      .when(sfn.Condition.numberGreaterThan('$.users.NumberOfLikesPerUser', 1000), inputValidationFailed)
      .otherwise(
        createTestUserIdsTask
          .next(createTestUsersTask)
          .next(triggerAllLoadTask)
          .next(testComplete)
      );
    new sfn.StateMachine(this, 'Load Test StateMachine', {
      definition: loadtestDefinition,
      stateMachineName:"LoadTest",
    });

    //StepFunction to clean up load testing resources
    const cleanUpUsers = new lambda.NodejsFunction(this, 'cleanUpUsers', {
      environment: {
        USER_POOL_ID: props.userAuth.userPool.userPoolId,
      },
      role: lambdaCognitoPowerUserRole,
      timeout: cdk.Duration.minutes(5),
    });
    const cleanUpTask = new tasks.LambdaInvoke(this, 'Clean Up', {
      lambdaFunction: cleanUpUsers,
      retryOnServiceExceptions: true,
    });
    new sfn.StateMachine(this, 'Clean Up LoadTest StateMachine', {
      definition: cleanUpTask,
      stateMachineName:"LoadTestCleanUp",
    });
  }
}
