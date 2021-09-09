import * as cdk from '@aws-cdk/core';
import { Frontend } from './frontend/frontend';
import { Auth } from './common/auth';
import { FrontendConfig } from './frontend/frontend-config';
import { PostsService } from './postsService/posts-service';
import { Monitoring } from './common/monitoring';
import { Loadtesting } from './loadtesting/loadtesting';

export class MainStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create frontend infrastructure
    const frontend = new Frontend(this, "frontend");

    // create Cognito User Pool for Auth
    const userAuth = new Auth(this, "userAuth");

    // create Posts Service
    const postService = new PostsService(this, "postsService", {
      userAuth,
      activateBucket: frontend.activateBucket,
      activateDistribution: frontend.activateDistribution
    });

    // create Monitoring dashboards
    new Monitoring(this, "monitoring", {
      auth: userAuth
    });
    // create Load Testing tools
    new Loadtesting(this, "loadtesting", {
      userAuth: userAuth,
      postService: postService,
    })

    new FrontendConfig(this, 'frontendConfig', {
      auth: userAuth,
      frontend: frontend,
      postService: postService,
    });
  }
}
