import * as cdk from '@aws-cdk/core';
import { Auth } from '../common/auth';
import { PostsService } from '../postsService/posts-service';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';

export interface MonitoringConfigProps {
  auth: Auth
  postService: PostsService
}

export class Monitoring extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: MonitoringConfigProps) {
    super(scope, id);

    /* Tools */

    // Creates a generic Metric
    function createMetric(namespace: string, metricName: string, label: string, statistic: string, dimensions: cloudwatch.DimensionHash) {
      const metric = new cloudwatch.Metric({
        metricName,
        namespace,
        statistic: statistic,
        period: cdk.Duration.minutes(1),
        dimensions
      });

      return metric;
    }

    // Fill blanks areas in chart with lines
    function fillMetrics(label: string, metrics: Record<string,cloudwatch.IMetric>) {
      const mathMetric = new cloudwatch.MathExpression({
        expression: "FILL(METRICS(), 0)",
        usingMetrics: metrics,
        label: label
      });

      return mathMetric;
    }

    // Creates a generic time series widget
    function createWidget(label: string, metrics: cloudwatch.IMetric[]) {
      const widget = new cloudwatch.GraphWidget({
        title: label,
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
        liveData: true,
        left: metrics,
        leftYAxis: {
          showUnits: true
        }
      });
      return widget;
    }

    /* Create API usage custom metric */ 
    const apigwSearchMetric = new cloudwatch.MathExpression({
      expression: "SEARCH('{AWS/ApiGateway,ApiName,Method,Resource,Stage} (Method=\"GET\" OR Method=\"PUT\") AND MetricName=\"Count\"', 'Average', 300)",
      usingMetrics: {}, //https://github.com/aws/aws-cdk/issues/7237
    });
    const apigwMathMetric = new cloudwatch.MathExpression({
      expression: "FILL(count, 0)",
      usingMetrics: { count: apigwSearchMetric },
      label: "Count"
    });
    const apigwWidget = new cloudwatch.GraphWidget({
      title: "API usage",
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      stacked: true,
      liveData: true,
      left: [apigwMathMetric],
      leftYAxis: {
        showUnits: true
      }
    });

    /* Business dashboard */
    const businessDashboard = new cloudwatch.Dashboard(this, "businessDashboard", {dashboardName: "BusinessDashboard"});
    businessDashboard.addWidgets(
      createWidget("Uploaded Pics", [
        fillMetrics("Count", { m1: createMetric("UnicornPics", "UploadedPics", "Uploads count", "SampleCount", {})})
      ]),
      createWidget("Likes", [
        fillMetrics("Count", { m1: createMetric("UnicornPics", "Likes", "Likes count", "SampleCount", {})})
      ]),
      createWidget("Dislikes", [
        fillMetrics("Count", { m1: createMetric("UnicornPics", "Dislikes", "Dislikes count", "SampleCount", {})})
      ]),
      createWidget("SignUps", [
        fillMetrics("Count", { m1: createMetric("UnicornPics", "SignUpSuccesses", "SignUps count", "SampleCount", {})})
      ]),
      apigwWidget
    ); 

    /* Technical dashboard */
    const technicalDashboard = new cloudwatch.Dashboard(this, "technicalDashboard", {dashboardName: "TechnicalDashboard"});
    technicalDashboard.addWidgets(
      createWidget("Lambda invocations", [
        fillMetrics("Count", { m1: createMetric("AWS/Lambda", "Invocations", "Invocations count", "SampleCount", {})})
      ]),
      createWidget("Lambda errors", [
        fillMetrics("Count", { m1: createMetric("AWS/Lambda", "Errors", "Errors count", "SampleCount", {})})
      ]),
      createWidget("Lambda durations", [
        fillMetrics("Duration", { m1: createMetric("AWS/Lambda", "Duration", "Executions duration", "Average", {})})
      ]),      
      createWidget("Lambda throttles", [
        fillMetrics("Count", { m1: createMetric("AWS/Lambda", "Throttles", "Throttles count", "SampleCount", {})})
      ]),
      createWidget("API Gateway errors", [
        fillMetrics("Count", { m1: createMetric("AWS/ApiGateway", "5XXError", "Errors count", "SampleCount", {ApiName: "Posts Service"})})
      ]),
      createWidget("API Gateway latency", [
        fillMetrics("Latency", { m1: createMetric("AWS/ApiGateway", "Latency", "Latency average", "Average", {ApiName: "Posts Service"})})
      ]),
      createWidget("API Gateway integration latency", [
        fillMetrics("Latency", { m1: createMetric("AWS/ApiGateway", "IntegrationLatency", "Integration latency average", "Average", {ApiName: "Posts Service"})})
      ]),
      createWidget("DynamoDB Capacity Units usage", [
        fillMetrics("Count", { 
          m1: createMetric("AWS/DynamoDB", "ConsumedReadCapacityUnits", "Used RCU count", "SampleCount", {TableName: props.postService.table.tableName}),
          m2: createMetric("AWS/DynamoDB", "ConsumedWriteCapacityUnits", "Used WCU count", "SampleCount", {TableName: props.postService.table.tableName}) 
        })
      ]),
    );
  }
}

