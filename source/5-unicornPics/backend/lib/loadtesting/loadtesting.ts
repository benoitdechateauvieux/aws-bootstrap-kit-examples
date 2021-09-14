import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda-nodejs';
import * as iam from '@aws-cdk/aws-iam';
import { Auth } from '../common/auth';
import { PostsService } from '../postsService/posts-service';
import * as assets from '@aws-cdk/aws-s3-assets';
import * as path from 'path';

interface LoadtestingProps {
  userAuth: Auth
  postService: PostsService
}

export class Loadtesting extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: LoadtestingProps) {
    super(scope, id);

    const unicornPic = new assets.Asset(this, 'UnicornPic', {
      path: path.resolve(__dirname, 'unicorn.png'),
    });

    const triggerLoadTestRole = new iam.Role(this, 'triggerLoadTestRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: "TriggerLoadTestRole"
    });
    triggerLoadTestRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
    triggerLoadTestRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonCognitoPowerUser"));
    triggerLoadTestRole.addToPolicy(new iam.PolicyStatement({
      actions: ["s3:GetObject","s3:GetObjectVersion"],
      resources: [unicornPic.bucket.arnForObjects(unicornPic.s3ObjectKey)],
    }));

    const triggerLoadTest = new lambda.NodejsFunction(this, 'triggerLoadTest', {
      environment: {
        USER_POOL_ID: props.userAuth.userPool.userPoolId,
        CLIENT_ID: props.userAuth.userPoolClient.userPoolClientId,
        API_URL: props.postService.postsApi.url,
        PICTURE_BUCKET: unicornPic.s3BucketName,
        PICTURE_KEY: unicornPic.s3ObjectKey,
      },
      role: triggerLoadTestRole,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
