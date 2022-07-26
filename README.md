# ransomwatch.org

## contents

this is the server side code written in nodejs for screenshotting Tor websites.
The code itself is just a puppeteer that connects to tor websites through a TOR proxy (which I setup on a different server. See the image below for instructions on how to setup a tor proxy)
Its written as a docker img that fetches a list of tor sites from Amazon DynamoDB (you can replace this with SQL), then crawls each one and takes screenshot of them all. Stores it on S3 then exists.
This project was run once a day on Azure Container Instances.



the lambdasubmitsite.js is redundant actually and can be ignore. Its a rest endpoint (aws lambda) to receive user submitted Tor sites.


# setup tor proxy
in the code you can see the following line

const config_tor_proxies = ["18.130.24.239:56826", "18.130.24.239:56824"]

I setup two instances of Tor and port 56826 and 56824. One is also sufficient.
![image](https://user-images.githubusercontent.com/1561576/181020543-f05103cd-0586-47e5-8e6e-14a98ac3af77.png)
