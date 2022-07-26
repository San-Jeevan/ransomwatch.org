const chromium = require('chrome-aws-lambda');
const config_tor_proxies = ["18.130.24.239:56826", "18.130.24.239:56824"]

const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "access-control-allow-methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
};


async function takeScreenshotWithoutImages(url) {
    const _args = [`--proxy-server=socks5://${config_tor_proxies[0]}`];
    let browser = await chromium.puppeteer.launch({
        args: chromium.args.concat(_args),
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: false,
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
            fullPage: true, encoding: "base64", type: 'jpeg',
            quality: 60});
        await browser.close();
        return { success: true, data: image_buffer };
    } catch (err) {
        console.error(err);
        return { success: false, data: "error time out" };
    }
}




async function takeScreenshot(url) {
    const _args = [
        `--proxy-server=socks5://${config_tor_proxies[1]}`,
        '--no-sandbox',
        '--no-zygote',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain',
        '--single-process',
        '--disable-gpu',
        '--disable-dev-shm-usage'
    ];


    let browser = await chromium.puppeteer.launch({
        args: _args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: false,
        ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    page.on("pageerror", err => {
        console.log(`Page error: ${err.toString()}`);
    });

    try {
        await page.goto(url, { timeout: 100 * 1000 });
        await page.evaluate(() => {
            let dom = document.getElementsByTagName("BODY")[0];
            if (dom.innerHTML.search(/([^.@\s]+)(\.[^.@\s]+)*@([^.@\s]+\.)+([^.@\s]+)/) !== -1) {
                console.log("There is an email !");
                dom.innerHTML = dom.innerHTML.replaceAll(/([^.@\s]+)(\.[^.@\s]+)*@([^.@\s]+\.)+([^.@\s]+)/ig, "RemovedBy@RansomWatch");
            }
        });

        let image_buffer = await page.screenshot({
            fullPage: true, encoding: "base64", type: 'jpeg',
            quality: 60
        });

        await browser.close();
        return { success: true, data: image_buffer };

    } catch (err) {
        console.log(err);
        console.error("network timeout on scraping, trying light version");
        console.log(url);
        let _lightresult = await takeScreenshotWithoutImages(url);
        return _lightresult;
    }
}


exports.handler = async (event, context, callback) => {
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: cors,
            body: JSON.stringify({ Message: "CORS OK" }),
        };
    }
    console.log(event.body.siteUrl);
    var _siteUrl = (JSON.parse(event.body)).siteUrl;

    var result = await takeScreenshot(_siteUrl);
    console.log("returning result:");
    return { statusCode: 200, body: JSON.stringify({ success: result.success, data: result.data }), headers: cors };
}


exports.handler({ body: '{ "siteUrl": "http://hiveleakdbtnp76ulyhi52eag6c6tyc3xw7ez7iqy6wc34gd2nekazyd.onion/"}' });