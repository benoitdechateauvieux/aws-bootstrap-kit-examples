import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';

const USER_POOL_ID             = process.env.USER_POOL_ID!;
const CLIENT_ID                = process.env.CLIENT_ID!;
const API_URL                  = process.env.API_URL!;
const NUMBER_OF_LIKES_PER_USER = 10

export const handler: Handler = async (event) => {
    console.log(USER_POOL_ID);
    console.log(CLIENT_ID);
    console.log(API_URL);

    const cognitoIsp = new AWS.CognitoIdentityServiceProvider();
    const params = {
        UserPoolId: USER_POOL_ID,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
            "USERNAME": "test",
            "PASSWORD": "test"
        }
    };
    const tokens = await cognitoIsp.adminInitiateAuth(params).promise();
    console.log(tokens);

    return {
        "statusCode": 200,
    }
}
