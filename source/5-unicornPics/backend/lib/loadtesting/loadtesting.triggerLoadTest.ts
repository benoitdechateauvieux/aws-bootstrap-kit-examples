import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import axios from 'axios';
const s3 = new AWS.S3();

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const API_URL = process.env.API_URL!;
const PICTURE_BUCKET = process.env.PICTURE_BUCKET!;
const PICTURE_KEY = process.env.PICTURE_KEY!;
const NUMBER_OF_LIKES_PER_USER = 10

export const handler: Handler = async (event) => {
    const username = event['username'];
    const password = event['password'];

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
    if (!tokens['AuthenticationResult'] || !tokens['AuthenticationResult']['IdToken']) {
        throw new Error('Missing Auth Token')
    }
    const apiHeaders = {
        authorization: tokens['AuthenticationResult']['IdToken'],
        accept: 'application/json',
        aud: CLIENT_ID,
    }

    const instance = axios.create();

    //1- Get the list of pictures
    const responseGet = await instance.get('/', {
        baseURL: API_URL,
        headers: apiHeaders,
    });
    if (responseGet.status != 200) {
        console.log(responseGet);
        throw new Error("Error while getting the list of unicorn pics");
    }
    //2- Upload a unicorn pic
    const responsePrepPost = await instance.put('/preparepost', {user: username}, {
        baseURL: API_URL,
        headers: apiHeaders,
    });
    if ((responsePrepPost.status != 200) || (!responsePrepPost.data['url'])) {
        console.log(responsePrepPost);
        throw new Error("Error while getting the URL to post pic");
    }
    const postPicUrl = responsePrepPost.data['url'];
    const picObject = await s3.getObject({
        Bucket: PICTURE_BUCKET,
        Key: PICTURE_KEY
    }).promise();
    const responsePost = await instance.put(postPicUrl, picObject.Body, {
        headers: {
            'Content-Type': 'image/png' ,
            'x-amz-meta-userid': responsePrepPost.data['userid'],
            'x-amz-meta-postid': responsePrepPost.data['postid'],
            'x-amz-meta-createdat': responsePrepPost.data['createdat'],
            'x-amz-meta-ownername': responsePrepPost.data['ownername'],
        },
    });
    if (responsePost.status != 200) {
        console.log(responsePost);
        throw new Error("Error while posting pic");
    }
    console.log("Pic uploaded");
    return {
        "statusCode": 200,
    }
}
