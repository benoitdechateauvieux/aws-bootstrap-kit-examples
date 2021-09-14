import { Handler } from 'aws-lambda';

export const handler: Handler = async (event) => {
    const usernames= [{
        "UserName": "benoit",
        "NumberOfLikesPerUser": 10,
    }]
    return {
        "statusCode": 200,
        "userNames": usernames,
    }
}
