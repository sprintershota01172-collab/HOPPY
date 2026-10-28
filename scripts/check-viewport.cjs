'use strict';
const { chromium }=require('playwright');
const {createServer}=require('http');
const {readFileSync,mkdirSync}=require('fs');
const path=require('path');
const assert=require('assert/strict');
const root=process.cwd();
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer((req,res)=>{
  const name=decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/+/, '')||'index.html';
  const target=path.resolve(root,name);
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(readFileSync(target));}
  catch(e){res.writeHead(404).end();}
});
(async()=>{
 const ver=JSON.parse(readFileSync('release.json','utf8')).version;
 mkdirSync('artifacts',{recursive:true});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const [width,height] of [[390,844],[375,667],[320,568]]){
   const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
   const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/visual-'+ver+'.html');
   await page.evaluate(()=>{
    const p={hasRun:1,purchaseYear:2028,firstChildYear:2028,children:2,propertyPrice:4400,loanYears:35,interest:1.5,husbandMonthly:25.5,wifeMonthly:25,foodMonthly:2.8,electricityMonthly:1,gasMonthly:.5,waterBiMonthly:.6};
    localStorage.setItem('hoppy-phase1-v1',JSON.stringify({version:2,properties:[],criteria:[],plan:p}));
   });
   await page.reload();
   await page.locator('[data-act="tab"][data-value="sim"]').first().click();
   await page.locator('.fp-result-nav').waitFor();
   await page.waitForTimeout(140);
   await page.locator('.fp-result-nav [data-value="1"]').click();
   await page.locator('.fp-month-four').waitFor();
   const initial=await page.evaluate(()=>({year:document.querySelector('[data-fp-year]')?.value,month:document.querySelector('[data-fp-cash-month]')?.value,nowYear:String(new Date().getFullYear()),nowMonth:String(new Date().getMonth()+1)}));
   assert.equal(initial.year,initial.nowYear);assert.equal(initial.month,initial.nowMonth);
   if(await page.locator('.fp-month-unrecorded').count()){
     assert.match(await page.locator('.fp-month-unrecorded').innerText(),/未登録/);
     await page.waitForTimeout(150);
     await page.locator('[data-act="fp-month-next"]').click();
     await page.locator('.fp-month-donut').waitFor();
   }
   const info=await page.evaluate(()=>{
    const bounds={};
    for(const s of ['.fp-month-four','.fp-month-donut','.fp-breakdown-panel']){const r=document.querySelector(s)?.getBoundingClientRect();bounds[s]=r?{left:r.left,right:r.right,width:r.width,height:r.height}:null;}
    return {bounds,scrollWidth:document.documentElement.scrollWidth,year:document.querySelector('[data-fp-year]')?.value,month:document.querySelector('[data-fp-cash-month]')?.value};
   });
   const browserClock=await page.evaluate(()=>({year:String(new Date().getFullYear()),month:String(new Date().getMonth()+1)}));
   console.log('Month initialization',info.month,'browser',browserClock.month);
   assert.ok(Number(info.year)>=Number(browserClock.year));
   assert.ok(info.scrollWidth<=width+2,'Horizontal page overflow');
   for(const [key,r] of Object.entries(info.bounds)){assert.ok(r,key+' missing');assert.ok(r.left>=-2&&r.right<=width+2,key+' outside viewport');}
   const oldDiameter=info.bounds['.fp-month-donut'].width;
   await page.locator('[data-fp-year]').selectOption('2027');
   assert.equal(await page.locator('.fp-month-donut').evaluate(e=>e.getBoundingClientRect().width),oldDiameter,'Chart diameter changed');
   await page.screenshot({path:'artifacts/month-'+width+'.png'});
   await page.waitForTimeout(140);
   await page.locator('.fp-result-nav [data-value="5"]').click();
   await page.locator('.fp-loan-focus').waitFor();
   const loan=await page.locator('.fp-loan-focus').innerText();
   assert.match(loan,/購入後の家計：2029年/);assert.match(loan,/金利込み月返済額/);assert.match(loan,/金利込み総返済額/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Loan horizontal overflow');
   await page.screenshot({path:'artifacts/loan-'+width+'.png'});
   await page.waitForTimeout(140);
   await page.locator('.fp-result-nav [data-value="3"]').click();
   await page.locator('[data-fp-year]').first().selectOption('2034');
   await page.waitForTimeout(140);
   await page.locator('.fp-result-nav [data-value="1"]').click();
   assert.equal(await page.locator('[data-fp-year]').first().inputValue(),'2027','Monthly year changed from future selection');
   assert.deepEqual(errors,[],'Browser runtime errors');
   console.log('PASS simulated iPhone viewport '+width+'x'+height+'; layout, donut, dates and loan UI');
   await ctx.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
