'use strict'

const fs = require("fs").promises;

const axios = require("axios");
const faker = require('faker');
const parse = require('node-html-parser').parse;

const utils = require('./utils')

faker.locale = "zh_CN";

const defaultQueryCity = "杭州"
const defaultKeyword = "golang"
const citySavePath = "city.json"
let cityCode;
let jobs = []

async function getCity() {
    let res = await axios.get('https://www.zhipin.com/wapi/zpCommon/data/city.json');
    await fs.writeFile(citySavePath, JSON.stringify(res.data), 'utf8');
}

async function getCityCode() {
    await getCity()

    let city = await fs.readFile(citySavePath, 'utf8')
    city = JSON.parse(city)
    let hotCityList = city.zpData.hotCityList

    for (let city of hotCityList) {
        if (city.name === defaultQueryCity) {
            cityCode = city.code;
            break;
        }
    }
    if (!cityCode) {
        console.log("don't find city code")
        process.exit()
    }
}

async function getCityJob() {
    let page = 1
    while(true) {
        let res = await axios.get('https://www.zhipin.com/mobile/jobs.json', {
            headers: {
                'User-Agent': faker.internet.userAgent()
            },
            params: {
                'query': defaultKeyword,
                'page' : page,
                'city': cityCode
            }
        });

        let data = JSON.parse(JSON.stringify(res.data));
        let code = data.html;
        if (!code) {
            break;
        }

        const root = parse(code)
        for (let job of root.querySelectorAll('li.item')) {
            jobs.push({
                "职位名称": job.querySelector('div.title h4').text,
                "职位链接": "https://www.zhipin.com"+job.querySelector('a').getAttribute('href'),
                "公司名称": job.querySelector('div.name').text,
                "薪资": job.querySelector('div.title .salary').text,
                // "工作地点": job.querySelectorAll('div.msg em')[0].text,
                "工作经验": job.querySelectorAll('div.msg em')[1].text,
                "学历要求": job.querySelectorAll('div.msg em')[2].text,
            })
        }
        page++;
        utils.msleep(200)
    }
}

(async function () {
    await getCityCode()
    await getCityJob()
    console.table(jobs)
})()
