const chromium = require('puppeteer');
const { Readable } = require('stream');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({ apiVersion: '2006-03-01', signatureVersion: 'v4', accessKeyId: 'AKIA2HUL2XJFJ7TZL6PI', secretAccessKey: 'REMOVED', region: 'eu-north-1' });
const docClient = new AWS.DynamoDB.DocumentClient({ signatureVersion: 'v4', accessKeyId: 'AKIA2HUL2XJFOEBG2KES', secretAccessKey: 'REMOVED', region: 'eu-north-1' });
const config_tor_proxies = ["18.130.24.239:56826", "18.130.24.239:56824"]

function bufferToStream(binary) {
    const readableInstanceStream = new Readable({
        read() {
            this.push(binary);
            this.push(null);
        }
    });
    return readableInstanceStream;
}

function isDateOlderThan30days(screenshotDate) {
    var timestamp_screenshot = Date.parse(screenshotDate);
    var timestamp_30_days = new Date().getTime() - (30 * 24 * 60 * 60 * 1000)
    if (isNaN(timestamp_screenshot) === false) {
        if (timestamp_screenshot < timestamp_30_days) return true;
    }
    return false;
}

async function UpdateItemDynamoDb(siteid) {
    return new Promise((resolve, reject) => {
        let date = new Date();

        var params = {
            TableName: "ransomWatchSites",
            Key: {
                "siteid": siteid,
            },
            UpdateExpression: "set lastScreenshot = :r",
            ExpressionAttributeValues: {
                ":r": date.toISOString()
            },
            ReturnValues: "UPDATED_NEW"
        };

        console.log("Updating the item...");
        docClient.update(params, function (err, data) {
            if (err) {
                console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
                reject(err);
            } else {
                console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
                resolve(true);
            }
        });
    })
}

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
    return itemsAll;
}

function UploadToS3(bufferdata, s3filename) {
    return new Promise((resolve, reject) => {
        const upload = s3.upload({
            Bucket: 'ransomwatchs3',
            Key: "screenshots" + s3filename,
            ACL: "public-read",
            Body: bufferToStream(bufferdata),
            ContentType: "image/png"
        }
        );

        upload.on('httpUploadProgress', (progress) => {
            console.log(`copying ss ...`, progress);
        });

        upload.send((err) => {
            if (err) {
                reject(false);
            } else {
                resolve(true);
            }
        });
    })
};

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2)
        month = '0' + month;
    if (day.length < 2)
        day = '0' + day;

    return [day, month, year].join('.');
}

function initiationMessage() {
    console.log("-----------------------");
    console.log("INITATION TOR CRAWLER 3.0");
    console.log("-----------------------");
}

async function takeScreenshotWithoutImages(url, siteid) {
    const _args = [`--proxy-server=socks5://${config_tor_proxies[0]}`];
    const _args2 = [
        '--no-sandbox',
        '--no-zygote',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain',
        '--single-process',
        '--disable-gpu',
        '--disable-dev-shm-usage'
    ];
    let browser = await chromium.launch({
        defaultViewport: { width: 1920, height: 1080 },
        args: _args2.concat(_args),
        headless: true,
        ignoreHTTPSErrors: true,
    });


    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (req) => {
        if (req.resourceType() === 'image') {
            req.abort();
        }
        else {
            req.continue();
        }
    });


    page.on("pageerror", err => {
        console.log(`Page error: ${err.toString()}`);
    });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.content();



        await page.evaluate(() => {
            let dom = document.getElementsByTagName("BODY")[0];


            if (dom.innerHTML.search(/([^.@\s]+)(\.[^.@\s]+)*@([^.@\s]+\.)+([^.@\s]+)/) !== -1) {
                console.log("There is an email !");
                dom.innerHTML = dom.innerHTML.replaceAll(/([^.@\s]+)(\.[^.@\s]+)*@([^.@\s]+\.)+([^.@\s]+)/ig, "RemovedBy@RansomWatch");
            }
        });


        let image_buffer = await page.screenshot({
            fullPage: true
        });

        console.log("uploading to s3");
        await UploadToS3(image_buffer, `/` + siteid + `/` + formatDate(new Date()) + ".png");
        await browser.close();
        return { success: true, data: "" };
    } catch (err) {
        console.error(err);
        await browser.close();
        return { success: false, data: "error time out" };
    }
}

async function takeScreenshot(url, siteid) {
    const _args = [`--proxy-server=socks5://${config_tor_proxies[1]}`];
    const _args2 = [
        '--no-sandbox',
        '--no-zygote',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain',
        '--single-process',
        '--disable-gpu',
        '--disable-dev-shm-usage'
    ];


    let browser = await chromium.launch({
        defaultViewport: { width: 1920, height: 1080 },
        args: _args.concat(_args2),
        headless: true,
        ignoreHTTPSErrors: true,
    });


    const page = await browser.newPage();

    page.on("pageerror", err => {
        console.log(`Page error: ${err.toString()}`);
    });

    try {
        await page.goto(url, { timeout: 100 * 1000 });
        await page.waitForTimeout(3000);

        await page.evaluate(() => {
            let dom = document.getElementsByTagName("BODY")[0];

            if (dom.innerHTML.search(/([^.@\s]+)(\.[^.@\s]+)*@([^.@\s]+\.)+([^.@\s]+)/) !== -1) {
                console.log("There is an email !");
                dom.innerHTML = dom.innerHTML.replaceAll(/([^.@\s]+)(\.[^.@\s]+)*@([^.@\s]+\.)+([^.@\s]+)/ig, "RemovedBy@RansomWatch");
            }
        });


        let image_buffer = await page.screenshot({
            fullPage: true
        });

        console.log("uploading to s3");
        await UploadToS3(image_buffer, `/` + siteid + `/` + formatDate(new Date()) + ".png");
        await browser.close();
        return { success: true, data: "" };

    } catch (err) {
        console.log(err);
        console.error("network timeout on scraping, trying light version");
        console.log(url);
        console.log(siteid);
        await browser.close();
        let _lightresult = await takeScreenshotWithoutImages(url, siteid);
        return _lightresult;
    }
}


(async () => {
    initiationMessage();
    var _sites = await GetTorSitesFromDynamoDb();
    _sites = _sites.sort((a, b) => a.siteid - b.siteid);
    console.log(_sites);
    for (var i = 0; i < _sites.length; i++) {
        console.log(`Processing ${i+1} out of ${_sites.length}`)
        if (_sites[i].siteUrl === "" || isDateOlderThan30days(_sites[i].lastScreenshot)) {
            console.log(`skipping, url or site has been dead for 30 days`);
            continue;
        }
  

        var isItOlder = ((new Date) - new Date(_sites[i].lastScreenshot)) < (60 * 60 * 1000);
        if (isItOlder) {
            console.log("fresh, skipping");
            continue;
        }


        console.log(`Taking screenshot: ${_sites[i].siteName}`);
        let _localresult = await takeScreenshot(_sites[i].siteUrl, _sites[i].siteid)

        if (_localresult.success) {
            await UpdateItemDynamoDb(_sites[i].siteid);
        }
        console.log(_localresult);
    }
    return;

})();
