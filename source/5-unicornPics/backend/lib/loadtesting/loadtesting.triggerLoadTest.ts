import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import axios from 'axios';

const USER_POOL_ID             = process.env.USER_POOL_ID!;
const CLIENT_ID                = process.env.CLIENT_ID!;
const API_URL                  = process.env.API_URL!;
const NUMBER_OF_LIKES_PER_USER = 10

export const handler: Handler = async (event) => {
    const username = event['username'];
    const password = event['password'];

    console.log({
        USER_POOL_ID,
        CLIENT_ID,
        API_URL,
        username,
    });

    const cognitoIsp = new AWS.CognitoIdentityServiceProvider();
    const params = {
        UserPoolId: USER_POOL_ID,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
            "USERNAME": username,
            "PASSWORD": password
        }
    };
    const tokens = await cognitoIsp.adminInitiateAuth(params).promise();
    console.log(tokens);
    if (!tokens['AuthenticationResult'] || !tokens['AuthenticationResult']['IdToken']) {
        throw new Error('Missing Auth Token')
    }

    axios.defaults.baseURL = API_URL;
    axios.defaults.headers.common['authorization'] = tokens['AuthenticationResult']['IdToken'];
    axios.defaults.headers.common['accept'] = 'application/json';
    axios.defaults.headers.common['aud'] = CLIENT_ID;
    const instance = axios.create();
    const response = await instance.get('/');
    console.log(response.data);

    return {
        "statusCode": 200,
    }
}
