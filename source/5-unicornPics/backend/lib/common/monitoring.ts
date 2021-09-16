import * as cdk from '@aws-cdk/core';
import { Auth } from '../common/auth';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';

export interface MonitoringConfigProps {
  auth: Auth;
}

export class Monitoring extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: MonitoringConfigProps) {
    super(scope, id);

    //UnicornPics metrics
    function createWidget(namespace:string, metricName: string, dimensions: cloudwatch.DimensionHash) {
      const metric = new cloudwatch.Metric({
        metricName,
        namespace,
        statistic: "SampleCount",
        period: cdk.Duration.minutes(1),
        label: metricName,
        dimensions
      });
      const mathMetric = new cloudwatch.MathExpression({
        expression: "FILL(METRICS(), 0)",
        usingMetrics: { likes: metric },
        label: "Count"
      });
      const widget = new cloudwatch.GraphWidget({
        title: metricName,
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
        liveData: true,
        left: [mathMetric],
        leftYAxis: {
          showUnits: false
        }
      });
      return widget;
    }

    //API usage
    const apigwSearchMetric = new cloudwatch.MathExpression({
      expression: "SEARCH('{AWS/ApiGateway,ApiName,Method,Resource,Stage} (Method=\"GET\" OR Method=\"PUT\") AND MetricName=\"Count\"', 'SampleCount', 300)",
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
        showUnits: false
      }
    });

    // Create business dashboard
    const businessDashboard = new cloudwatch.Dashboard(this, "businessDashboard", {
      dashboardName: "BusinessDashboard",
    });
    businessDashboard.addWidgets(
      createWidget("UnicornPics", "UploadedPics", {}),
      createWidget("UnicornPics", "Likes", {}),
      createWidget("UnicornPics", "Dislikes", {}));
    businessDashboard.addWidgets(
      createWidget("AWS/Cognito", "SignUpSuccesses", {UserPool: props.auth.userPool.userPoolId, UserPoolClient: props.auth.userPoolClient.userPoolClientId}),
      apigwWidget);
  }
}