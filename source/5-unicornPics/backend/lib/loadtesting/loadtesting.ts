import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda-nodejs';
import * as iam from '@aws-cdk/aws-iam';
import { Auth } from '../common/auth';
import { PostsService } from '../postsService/posts-service';

interface LoadtestingProps {
  userAuth: Auth
  postService: PostsService
}

export class Loadtesting extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: LoadtestingProps) {
    super(scope, id);

    const triggerLoadTestRole = new iam.Role(this, 'triggerLoadTestRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: "TriggerLoadTestRole"
    });
    triggerLoadTestRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    triggerLoadTestRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonCognitoPowerUser"));

    const triggerLoadTest = new lambda.NodejsFunction(this, 'triggerLoadTest', {
      environment: {
        USER_POOL_ID: props.userAuth.userPool.userPoolId,
        CLIENT_ID: props.userAuth.userPoolClient.userPoolClientId,
        API_URL: props.postService.postsApi.url
      },
      role: triggerLoadTestRole
    });
  }
}
