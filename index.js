const anycaptcha_key = ''
const crypto = require('node:crypto');
const puppeteer = require('puppeteer');
const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio');
const cors = require('cors')

var https = require('https');
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
     secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
   })
});
var fs = require('fs');
const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.json());
app.use(cors())
const port = 27126



function base64_encode(file) {
    var bitmap = fs.readFileSync(file);
    return  Buffer.from(bitmap).toString('base64');
}

function delay(time) {
   return new Promise(function(resolve) { 
       setTimeout(resolve, time)
   });
}

function getParam(url, key){
	var url = new URL(url);
	return url.searchParams.get(key);
}

const resolveCaptcha = async (captcha) => {
	let { data } = await axiosInstance({
			method: 'post',
			url: 'https://autocaptcha.pro/apiv3/process',
			headers: { 
			    'Content-Type': 'application/json'
			},
			data: JSON.stringify({
			  "key": "2b9b3456b77c59a4c57e0f45ea21dcee",
			  "type": "imagetotext",
			  "img": captcha,
			  "module": "common",
			  "casesensitive": false
			})
	})
	console.log(data);

	if(data.success)
		return data.captcha;
	return false

}

function login_(username, password){
    try {
    	return new Promise(async (res, rej) => {

    		const browser = await puppeteer.launch({args: [
    			'--no-sandbox', 
    			'--disable-setuid-sandbox',
    			'--disable-dev-shm-usage',
			    '--disable-accelerated-2d-canvas',
			    '--no-first-run',
			    '--no-zygote',
			    '--single-process', 
			    '--disable-gpu'
    			], headless: false});
    		const page = await browser.newPage();
    		 await page.setDefaultNavigationTimeout(0);
    		await page.goto('https://www.bidv.vn/iBank/MainEB.html', { waitUntil: 'networkidle0' })

    		await page.type('#username', username)
    		await page.type('#password', password)


    		  await page.evaluate((username) => {
    		    document.getElementById('username').value = username;
    		  }, username);

    		  await page.evaluate((password) => {
    		    document.getElementById('password').value = password;
    		  }, password);
    		await delay(3000)
    		

    		const base64Image = await page.evaluate(() => {
    		    const img = document.getElementById('idImageCap'); // Replace with your element's ID
    		    return img.src; // Get the base64 string from the src attribute
    		  });

    		console.log(base64Image);


  		  const captcha = await resolveCaptcha(base64Image);

  		  if(!captcha)
		  		return {success: false, msg: 'Giải captcha thất bại'} 

		  	await page.evaluate((captcha) => {
		  	  document.getElementById('captcha').value = captcha;
		  	}, captcha);

    		await delay(500)

    		await page.evaluate(() => {
    		    document.getElementById('btLogin').click()
    		  });

    		await delay(3000)
    		

    		


        const cookies = await page.cookies();
        const result = cookies.map(el => {
        	return `${el.name}=${el.value}`
        }).join(';')


       

        fs.writeFileSync('./'+username+'.json', JSON.stringify({cookies: result}, null, 2));
    		res(true)
    	})

    } catch (error) {
        console.log(error);
    }
}


const getTranAPI = async (data, accountNumber) => {
	let postdata = `SERVICESID=ONLACCINQ&subsvc=getTransactionHistoryOnline&accountNo=${accountNumber}&currency=VND`;
	var config = {
	  method: 'post',
	  url: 'https://www.bidv.vn/iBank/MainEB.html?transaction=eBankBackend',
	  headers: { 
	    'Accept': 'application/json, text/javascript, */*; q=0.01', 
	    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5', 
	    'Cache-Control': 'no-cache', 
	    'Connection': 'keep-alive', 
	    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 
	    'Origin': 'https://www.bidv.vn', 
	    'Pragma': 'no-cache', 
	    'RESULT_TYPE': 'JSON_GRID', 
	    'Sec-Fetch-Dest': 'empty', 
	    'Sec-Fetch-Mode': 'cors', 
	    'Sec-Fetch-Site': 'same-origin', 
	    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
	    'X-Requested-With': 'XMLHttpRequest', 
	    'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"', 
	    'sec-ch-ua-mobile': '?0', 
	    'sec-ch-ua-platform': '"Windows"',
	    'Cookie': data.cookies
	  },
	  data : postdata
	};
	
	return axiosInstance(config)
}


const getTransaction = async ({username, password, accountNumber}) => {
	// if(!fs.existsSync(`./${username}.json`)){
	// 	await login_(username, password);
	// }

	let rawdata = fs.readFileSync('./'+username+'.json');
	let data = JSON.parse(rawdata);
	
	let res = await getTranAPI(data, accountNumber)
	
	if(res.data.errorCode !== 1){
		return res.data
	}

	return res.data


}

const getBalance = async (username, password) => {
	let rawdata = fs.readFileSync('./'+username+'.json');
	let data = JSON.parse(rawdata);
	
	let postdata = 'keyWord=&currencyDefault=VND&hostUnit=Y&memberUnits=0&take=100&skip=0&page=1&pageSize=100';

	let config = {
	  method: 'post',
	  maxBodyLength: Infinity,
	  url: 'https://www.bidv.vn/iBank/MainEB.html?transaction=PaymentAccount&method=getMain&_ACTION_MODE=search',
	  headers: { 
	    'Accept': 'application/json, text/javascript, */*; q=0.01', 
	    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5', 
	    'Cache-Control': 'no-cache', 
	    'Connection': 'keep-alive', 
	    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 
	    'Origin': 'https://www.bidv.vn', 
	    'Pragma': 'no-cache', 
	    'RESULT_TYPE': 'JSON_GRID', 
	    'Sec-Fetch-Dest': 'empty', 
	    'Sec-Fetch-Mode': 'cors', 
	    'Sec-Fetch-Site': 'same-origin', 
	    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 
	    'X-Requested-With': 'XMLHttpRequest', 
	    'sec-ch-ua': '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"', 
	    'sec-ch-ua-mobile': '?0', 
	    'sec-ch-ua-platform': '"Windows"', 
	    'Cookie': data.cookies,
	    'token': '3YnB4nPaRu6tFubvFECcreYR3CX9bPEFuwPBHGBc6Bd9XZBJCZ'
	  },
	  data : postdata
	};

	console.log(config);

	const res = await axiosInstance(config)
	console.log(res);
	if(res.data.errorCode !== 1){
		return res.data
	}

	return res.data


}


// getTransaction({username: '15978817G148', password: 'Tino@123!@#', begin: '28/12/2022', end: '28/12/2022', accountNumber: '0881000477617'})
app.post('/login', async (req, res, next) => {
	try {
		const { username, password, begin, end, accountNumber } = req.body

		const data = await login_(username, password)
		if(data)
			return res.status(200).send({data, success: true})

		return res.status(200).send({msg: 'Có lỗi xảy ra hãy kiểm tra lại thông tin tài khoản', success: false})
	} catch (err) {
	  return res.status(200).send(err)
	}


})

app.post('/balance', async (req, res, next) => {
	try {
		const { username, password, accountNumber } = req.body

		const data = await getBalance(username, password)
		if(data)
			return res.status(200).send({data, success: true})

		return res.status(200).send({msg: 'Có lỗi xảy ra hãy kiểm tra lại thông tin tài khoản', success: false})
	} catch (err) {
	  return res.status(200).send(err)
	}


})
app.post('/transactions', async (req, res, next) => {
	try {
		const { username, password, accountNumber } = req.body
		
		const data = await getTransaction({username, password, accountNumber})
		if(data)
			return res.status(200).send({data, success: true})

		return res.status(200).send({msg: 'Có lỗi xảy ra hãy kiểm tra lại thông tin tài khoản', success: false})
	} catch (err) {
	  return res.status(200).send(err)
	}


})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})