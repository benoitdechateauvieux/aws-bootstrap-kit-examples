#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LoadtestingStack } from '../lib/loadtesting-stack';

const app = new cdk.App();
new LoadtestingStack(app, 'LoadtestingStack', {});
