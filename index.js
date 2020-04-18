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
const spinner = ora("Loading...");

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

    let jobs = {};
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
            let experience = job.querySelectorAll("div.msg em")[1].text;
            // Remove Part time job
            if (!experience) {
                continue
            }
            if (!jobs[experience]) {
                jobs[experience] = []
            }
            jobs[experience].push({
                "Title": job.querySelector("div.title h4").text,
                "URL": "https://www.zhipin.com" + job.querySelector("a").getAttribute("href"),
                "Company": job.querySelector("div.name").text,
                "Salary": job.querySelector("div.title .salary").text,
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
    return await Promise.all(promises);
}

async function wrapperSpinner(f) {
    spinner.start()
    let r = await f()
    spinner.stop();
    return r
}

(async function () {
    let allJobs = await wrapperSpinner(getCityJob);
    allJobs.forEach(j => {
        for (let ep of Object.keys(j).sort()) {
            console.log(ep)
            let jobs = j[ep];
            jobs.sort((a, b) => {
                return Number(a.Salary.split("-")[0]) - Number(b.Salary.split("-")[0])
            })
            console.table(jobs);
        }
    })
})();
