const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173');
 const bytes=require('node:fs').readFileSync('flower.webm');
 await page.locator('#upload').click();await page.locator('[name=title]').fill('Video kiểm thử');await page.locator('input[type=file]').setInputFiles({name:'demo.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)});
 await page.locator('#video-preview').waitFor({state:'visible',timeout:5000});await page.locator('#post-form button[type=submit]').click();await page.locator('.post video').waitFor();
 await page.reload();await page.locator('.post video').waitFor();assert.equal(await page.locator('.post video').getAttribute('autoplay'),null);await page.locator('.post video').evaluate(v=>v.play());assert.ok(await page.locator('.post video').evaluate(v=>!v.paused));
 await page.locator('#upload').click();await page.locator('input[type=file]').setInputFiles({name:'bad.webm',mimeType:'video/webm',buffer:Buffer.from('not a video')});await page.waitForFunction(()=>document.querySelector('#upload-error').textContent.length>0);assert.equal(await page.locator('#post-form button[type=submit]').isDisabled(),true);await page.locator('#upload-dialog .close').click();
 await page.locator('.post').filter({has:page.locator('video')}).locator('[data-action=share]').click();await page.locator('#share-dialog').waitFor({state:'visible'});assert.ok((await page.locator('#share-note').innerText()).includes('trình duyệt'));
 console.log('PASS: video upload, durable reload, playback, no autoplay, invalid media rejected, honest sharing notice.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
