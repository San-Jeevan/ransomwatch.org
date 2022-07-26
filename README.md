# ransomwatch.org

## contents

this is the server side code written in nodejs for screenshotting Tor websites.
Its written as a docker img that fetches a list of tor sites from Amazon DynamoDB (you can replace this with SQL), then crawls each one and takes screenshot of them all. Stores it on S3 then exists.
This project was run once a day on Azure Container Instances.
