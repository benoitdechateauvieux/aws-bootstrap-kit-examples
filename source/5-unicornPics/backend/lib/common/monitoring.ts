import * as cdk from '@aws-cdk/core';
import { Auth } from '../common/auth';
import * as cloudwatch from '@aws-cdk/aws-cloudwatch';

export interface MonitoringConfigProps {
  auth: Auth;
}

export class Monitoring extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: MonitoringConfigProps) {
    super(scope, id);

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

    // Create business dashboard
    const businessDashboard = new cloudwatch.Dashboard(this, "businessDashboard", {
      dashboardName: "BusinessDashboard",
    });
    businessDashboard.addWidgets(createWidget("UnicornPics", "UploadedPics", {}), createWidget("UnicornPics", "Likes", {}), createWidget("UnicornPics", "Dislikes", {}));
    businessDashboard.addWidgets(createWidget("AWS/Cognito", "SignUpSuccesses", {UserPool: props.auth.userPool.userPoolId, UserPoolClient: props.auth.userPoolClient.userPoolClientId}));
  }
}