"use strict";

const fs = require("fs");
const fsp = fs.promises;
const ora = require("ora");
const axios = require("axios");
const faker = require("faker");
faker.locale = "zh_CN";
const parse = require("node-html-parser").parse;
const utils = require("./utils");

require("dotenv").config();

const citySavePath = "city.json";

async function getCity() {
    let res = await axios.get(
        "https://www.zhipin.com/wapi/zpCommon/data/city.json"
    );
    await fsp.writeFile(citySavePath, JSON.stringify(res.data), "utf8");
}

async function getCityCode() {
    if (!fs.existsSync(citySavePath)) {
        await getCity();
    }

    let city = await fsp.readFile(citySavePath, "utf8");
    city = JSON.parse(city);
    let hotCityList = city.zpData.hotCityList;

    let cityCode;
    for (let city of hotCityList) {
        if (city.name === process.env.QUERY_CITY) {
            cityCode = city.code;
            break;
        }
    }
    if (!cityCode) {
        console.error("don't find city code");
        process.exit();
    }
    return cityCode;
}

async function getKeywordJob(cityCode, keyword) {

    let jobs = [];
    let page = 1;
    while (true) {
        let res = await axios.get("https://www.zhipin.com/mobile/jobs.json", {
            headers: {
                "User-Agent": faker.internet.userAgent(),
            },
            params: {
                query: keyword,
                page: page,
                city: cityCode,
            },
        });

        let data = JSON.parse(JSON.stringify(res.data));
        let code = data.html;
        if (!code) {
            break;
        }

        const root = parse(code);
        for (let job of root.querySelectorAll("li.item")) {
            jobs.push({
                "职位名称": job.querySelector("div.title h4").text,
                "职位链接": "https://www.zhipin.com" + job.querySelector("a").getAttribute("href"),
                "公司名称": job.querySelector("div.name").text,
                "薪资": job.querySelector("div.title .salary").text,
                // "工作地点": job.querySelectorAll('div.msg em')[0].text,
                "工作经验": job.querySelectorAll("div.msg em")[1].text,
                "学历要求": job.querySelectorAll("div.msg em")[2].text,
            });
        }

        if (page > process.env.QUERY_PAGE) {
            break;
        }

        page++;
        utils.msleep(200);
    }
    return jobs
}

async function getCityJob() {
    let cityCode = await getCityCode();
    let promises = process.env.QUERY_KEYWORD.split(",").map(k => getKeywordJob(cityCode, k));

    const spinner = ora("Loading...");
    spinner.start();
    let allJobs = await Promise.all(promises);
    spinner.stop();
    return allJobs;
}

(async function () {
    let jobs = await getCityJob();
    jobs.forEach(j => {
        console.table(j);
    })
})();
