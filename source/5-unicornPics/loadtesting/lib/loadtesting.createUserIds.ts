import { Handler } from 'aws-lambda';

export const handler: Handler = async (event) => {
    const numberOfUsers = event['NumberOfUsers'];
    const numberOfLikesPerUser = event['NumberOfLikesPerUser'];
    console.log('Generating '+numberOfUsers+' users with numberOfLikesPerUser='+numberOfLikesPerUser);

    const usernames = new Array();
    for (let i=0; i<numberOfUsers; i++) {
        usernames.push({
            "UserName": "loadtestuser"+i,
            "NumberOfLikesPerUser": numberOfLikesPerUser,
        });
    };

    return {
        "statusCode": 200,
        "userNames": usernames,
    }
}
