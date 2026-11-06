import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {chromium} from 'playwright';
import {inspectCaptchaState} from '../dist/adapters/captcha.js';
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM_PATH,args:['--no-sandbox']});});
after(async()=>{await browser?.close();});
async function check(html,blocking){
 const page=await browser.newPage();
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<html><body>Mock provider frame</body></html>'}));
 try{await page.setContent(html);const state=await inspectCaptchaState(page);assert.equal(state.present,true);assert.equal(state.blocking,blocking);}finally{await page.close();}
}
test('invisible checks and site-owned submit bindings remain available without token interaction',async()=>{
 for(const html of [
  '<div class="g-recaptcha" data-sitekey="fixture" data-size="invisible"></div>',
  '<button class="h-captcha" data-sitekey="fixture" data-callback="siteCallback">Submit</button>',
  '<iframe src="https://www.recaptcha.net/recaptcha/enterprise/anchor?size=invisible" style="width:256px;height:60px"></iframe>',
  '<iframe src="https://www.recaptcha.net/recaptcha/api2/bframe" style="display:none;width:400px;height:400px"></iframe>'
 ]) await check(html,false);
});
test('visible checkboxes and challenges block even when the installation is invisible',async()=>{
 for(const html of [
  '<div class="g-recaptcha" data-sitekey="fixture"></div>',
  '<iframe src="https://www.recaptcha.net/recaptcha/api2/anchor?size=normal" style="width:302px;height:78px"></iframe>',
  '<div class="h-captcha" data-sitekey="fixture" data-size="invisible"></div><iframe title="hCaptcha challenge" src="https://newassets.hcaptcha.com/captcha.html?role=challenge" style="width:400px;height:400px"></iframe>',
  '<iframe title="Security challenge" src="https://example.test/security" style="width:400px;height:400px"></iframe>'
 ]) await check(html,true);
});
test('an explicit anti-bot refusal remains blocking',async()=>{
 await check('<iframe src="https://geo.captcha-delivery.com/captcha/" hidden></iframe>',true);
});
