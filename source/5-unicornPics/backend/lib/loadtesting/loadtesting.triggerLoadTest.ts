import * as AWS from 'aws-sdk';
import { Handler } from 'aws-lambda';
import axios from 'axios';
const s3 = new AWS.S3();

const USER_POOL_ID = process.env.USER_POOL_ID!;
const CLIENT_ID = process.env.CLIENT_ID!;
const API_URL = process.env.API_URL!;
const PICTURE_BUCKET = process.env.PICTURE_BUCKET!;
const PICTURE_KEY = process.env.PICTURE_KEY!;
const DEFAULT_NUMBER_OF_LIKES_PER_USER = 10;
const MAX_SLEEP_TIME_MS = 2000;

function randomSleep() {
    return new Promise(resolve => setTimeout(resolve, Math.random() * MAX_SLEEP_TIME_MS));
}

export const handler: Handler = async (event) => {
    const username = event['UserName'];
    const numberOfLikesPerUser = event['NumberOfLikesPerUser'] || DEFAULT_NUMBER_OF_LIKES_PER_USER;
    const password = 'Password1/';

    console.log(event);
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
    const existingPics = responseGet.data;
    console.log('[' + username + '] Got a list of ' + existingPics.length + ' pics');
    await randomSleep();

    //2- Upload a unicorn pic
    const responsePrepPost = await instance.put('/preparepost', { user: username }, {
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
            'Content-Type': 'image/png',
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
    console.log('[' + username + '] Unicorn pic uploaded');
    await randomSleep();

    //3- Liking pics
    for (let i = 0; (i < numberOfLikesPerUser && existingPics && existingPics.length > 0); i++) {
        const likedPic = existingPics.splice(Math.floor(Math.random() * existingPics.length), 1);
        const postId = likedPic[0]['postId'];
        const responseLike = await instance.put('/like', {
            user: username,
            post: postId,
        }, {
            baseURL: API_URL,
            headers: apiHeaders,
        });
        if (responseLike.status != 200) {
            console.log(responseLike);
            throw new Error("Error while liking pic with postId " + postId);
        }
        console.log('[' + username + '] Unicorn pic liked. PostId=' + postId);
        await randomSleep();
    }

    console.log('[' + username + '] End');
    return {
        "statusCode": 200,
    }
}
