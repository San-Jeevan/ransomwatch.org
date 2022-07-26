const AWS = require('aws-sdk');
const s3 = new AWS.S3({ apiVersion: '2006-03-01', signatureVersion: 'v4', accessKeyId: 'AKIA2HUL2XJFJ7TZL6PI', secretAccessKey: 'REMOVED', region: 'eu-north-1' });
const docClient = new AWS.DynamoDB.DocumentClient({ signatureVersion: 'v4', accessKeyId: 'AKIA2HUL2XJFOEBG2KES', secretAccessKey: 'REMOVED', region: 'eu-north-1' });
const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "access-control-allow-methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
};

function CreateS3Folder(foldername) {
    return new Promise((resolve, reject) => {
        const upload = s3.upload(
            {
                Bucket: 'ransomwatchs3',
                Key: "screenshots/" + foldername,
                ACL: "public-read",
                Body: "none"
            }
        );

        upload.send((err) => {
            if (err) {
                reject(false);
            } else {
                resolve(true);
            }
        });
    })
};

async function GetTorSitesFromDynamoDb() {
    let lastEvaluatedKey = 'dummy'; // string must not be empty
    const itemsAll = [];
    while (lastEvaluatedKey) {
        const data = await docClient.scan({ TableName: "ransomWatchSites" }).promise();
        itemsAll.push(...data.Items);
        lastEvaluatedKey = data.LastEvaluatedKey;
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }
    }
    console.log(itemsAll)
    return itemsAll;
}

async function AddSiteToDynamoDb(siteUrl, siteId, siteName) {
    return new Promise((resolve, reject) => {
        var params = {
            TableName: "ransomWatchSites",
            Item: {
                "siteid": siteId,
                "lastScreenshot": "",
                "siteDiffTreshold": 0.4,
                "siteName": siteName,
                "siteUrl": siteUrl,
            }
        };

        console.log("adding item...");
        docClient.put(params, function (err, data) {
            if (err) {
                console.error("Unable to adding item. Error JSON:", JSON.stringify(err, null, 2));
                reject(err);
            } else {
                console.log("adding succeeded:", JSON.stringify(data, null, 2));
                resolve(true);
            }
        });
    })
}

exports.handler = async (event) => {
    console.log(event);

    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify({ Message: "CORS OK" }),
        };
    }

    var _siteUrl = (JSON.parse(event.body)).siteUrl;
    if (_siteUrl === undefined) {
        return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify({ Success: false, Message: "Empty or malformed URL" }),
        };
    }


    var _siteName = (JSON.parse(event.body)).siteName === undefined ? "UserSubmitted" : (JSON.parse(event.body)).siteName;
    var _sites = await GetTorSitesFromDynamoDb();
    var alreadyExists = _sites.find(obj => {
        var existingSite = obj.siteUrl.replace(/(^\w+:|^)\/\//, '').toLowerCase();
        var newSite = _siteUrl.replace(/(^\w+:|^)\/\//, '').toLowerCase()
        return existingSite.substr(0, existingSite.indexOf('.onion')) === newSite.substr(0, newSite.indexOf('.onion'))
    })

    if (alreadyExists) {
        return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify({ Success: false, Message: `Site already exists: ${alreadyExists.siteName} and it was last seen online ${alreadyExists.lastScreenshot}` }),
        };
    }

    const highestSiteId = _sites.reduce(function (prev, current) {
        return (prev.siteid > current.siteid) ? prev : current
    })

    //add site
    await AddSiteToDynamoDb(_siteUrl, highestSiteId.siteid + 1, _siteName);
    //await CreateS3Folder(highestSiteId.siteid + 1);

    return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ Success: true, Message: `Site has been added. Our TOR-bot will automatically crawl and take screenshot within 24hours. You can close this window, or if you want, you can see a preview of crawl right below. it takes 10-60 seconds` }),
    };
};

//exports.handler({ body: '{ "siteUrl": "http://inxargjazy7xuzyculkp4rqni6ldiw5uxazzpx3klc4vfufsiwno4ad.onion/", "siteName": "Group name"}'});