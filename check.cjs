const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('.post').first().waitFor();
 assert.equal(await page.locator('.post').count(),4);
 await page.locator('[data-action="like"]').first().click();assert.equal(await page.locator('[data-action="like"]').first().getAttribute('aria-pressed'),'true');
 await page.reload();assert.equal(await page.locator('[data-action="like"]').first().getAttribute('aria-pressed'),'true');
 await page.locator('[data-action="comment"]').first().click();await page.locator('.comment-form input').fill('Bình luận kiểm thử <script>');await page.locator('.comment-form button').click();assert.ok((await page.locator('.comments').innerText()).includes('Bình luận kiểm thử <script>'));
 await page.locator('[data-action="save"]').first().click();await page.locator('.nav-item[data-tab="saved"]').click();assert.equal(await page.locator('.post').count(),1);
 await page.locator('.nav-item[data-tab="top"]').click();assert.ok((await page.locator('.post h3').first().innerText()).includes('cuối tuần'));
 await page.locator('#search').fill('không có từ này 123');assert.equal(await page.locator('.post').count(),0);await page.locator('#search').fill('');
 await page.locator('#upload').click();await page.locator('[name="title"]').fill('Ảnh thử nghiệm');await page.locator('input[type=file]').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});await page.locator('#preview').waitFor({state:'visible'});await page.locator('#post-form button[type=submit]').click();assert.equal(await page.locator('.post h3').first().innerText(),'Ảnh thử nghiệm');await page.reload();await page.locator('.tabs [data-tab="new"]').click();assert.equal(await page.locator('.post h3').first().innerText(),'Ảnh thử nghiệm');
 await page.evaluate(async()=>{localStorage.clear();await new Promise((resolve,reject)=>{const r=indexedDB.open('cuoi-da-media',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('posts','readwrite');tx.objectStore('posts').clear();tx.oncomplete=()=>{db.close();resolve()};tx.onerror=reject};r.onerror=reject})});await page.reload();await page.waitForTimeout(1800);await page.screenshot({path:'desktop-preview.png',fullPage:false});
 const images=await page.locator('.meme img').evaluateAll(imgs=>imgs.map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.src})));console.log('Images:',JSON.stringify(images));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'mobile-preview.png',fullPage:false});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: feed, voting persistence, comments escaping, bookmarks, sorting, search, upload persistence, mobile overflow, runtime errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
