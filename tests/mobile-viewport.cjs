'use strict';
// Automated Chromium checks at iPhone-like CSS viewport widths; not physical Safari validation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFile}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const harness=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>HOPPY viewport</title></head><body><pre id="result">LOADING</pre><script>
localStorage.setItem('hoppy-phase1-v1',JSON.stringify({
 version:2,properties:[],criteria:[],plan:{hasRun:1,purchaseYear:2028,firstChildYear:2028,
 husbandMonthly:26,wifeMonthly:25,foodMonthly:3,electricityMonthly:1,rentMonthly:8.2,propertyPrice:4400}
}));
const tests=[[320,'month'],[390,'month'],[320,'loan'],[390,'loan']];
const results=[],pre=document.getElementById('result');
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function check(frame,w,which){
 const win=frame.contentWindow,doc=win.document;
 const sel=which==='month'?'.fp-focus-report':'.fp-loan-focus';
 const node=doc.querySelector(sel);
 if(!node)return {width:w,screen:which,error:'screen missing'};
 const cards=Array.from(node.querySelectorAll(which==='month'?'.fp-focus-tile':'.fp-loan-card'));
 const money=Array.from(node.querySelectorAll(which==='month'?'.fp-focus-tile strong':'.fp-loan-feature strong,.fp-loan-interest strong'));
 const clipped=money.filter(x=>x.scrollWidth>x.clientWidth+2).map(x=>x.textContent.slice(0,35));
 const outside=cards.filter(x=>x.getBoundingClientRect().left<-1||x.getBoundingClientRect().right>win.innerWidth+1).length;
 const r=node.getBoundingClientRect(),displayWidth=doc.documentElement.scrollWidth;
 return {width:w,screen:which,viewportWidth:win.innerWidth,documentWidth:displayWidth,
    cards:cards.length,clipped,outside,top:Math.round(r.top),bottom:Math.round(r.bottom),
    labels:money.map(x=>x.textContent.trim()).slice(0,5)};
}
async function prepare(w,which){
 const frame=document.createElement('iframe');frame.style.width=w+'px';frame.style.height='740px';frame.style.border='0';
 document.body.appendChild(frame);
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/index.html?viewport='+w+which});
 await sleep(250);
 const doc=frame.contentDocument;
 const switchTo=doc.querySelector('[data-act="tab"][data-value="sim"]');
 if(!switchTo)return {width:w,screen:which,error:'FP main nav not found'};
 switchTo.click();await sleep(250);
 const n=which==='month'?1:5;
 const target=doc.querySelector('[data-act="fp-result-tab"][data-value="'+n+'"]');
 if(!target)return {width:w,screen:which,error:'FP icon nav not found'};
 target.click();await sleep(300);
 return check(frame,w,which);
}
(async()=>{
 for(const [w,which] of tests){
  try{results.push(await prepare(w,which))}
  catch(e){results.push({width:w,screen:which,error:String(e)})}
 }
 pre.textContent=JSON.stringify(results);
})()
</script></body></html>`;
const server=http.createServer((req,res)=>{
 let requested=new URL(req.url,'http://localhost').pathname;
 if(requested==='/__harness'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(harness)}
 requested=decodeURIComponent(requested);
 const file=path.resolve(root,'.'+requested);
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404);return res.end('not found')}
  const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':
     file.endsWith('.html')?'text/html':file.endsWith('.webmanifest')?'application/manifest+json':'application/octet-stream';
  res.writeHead(200,{'Content-Type':type});res.end(data);
 });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/__harness';
 try{
  const {stdout}=await new Promise((resolve,reject)=>execFile(process.env.CHROME_BIN||'google-chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--disable-background-networking','--no-first-run','--window-size=1300,920',
    '--virtual-time-budget=14000','--dump-dom',url
  ],{encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024},(error,stdout,stderr)=>{
    if(error)return reject(Error('Chromium: '+error.message+' '+stderr.slice(-1000)));
    resolve({stdout});
  }));
  const match=stdout.match(/<pre id="result">([^<]+)<\/pre>/);
  assert.ok(match,'viewport report not returned from browser: '+stdout.slice(-1200));
  const cases=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
  for(const row of cases){
    console.log('VIEWPORT '+JSON.stringify(row));
    assert.ok(!row.error,row.error);
    assert.equal(row.width,row.viewportWidth,'Unexpected emulated viewport width');
    assert.ok(row.documentWidth<=row.viewportWidth+2,'Horizontal screen overflow');
    assert.ok(row.cards>=2,'Missing cards');
    assert.equal(row.outside,0,'Cards outside viewport');
    assert.deepEqual(row.clipped,[],'Clipped key monetary values');
  }
  assert.equal(cases.length,4,'All phone sizes and screens must be checked');
  console.log('PASS: iPhone-width Chromium layout checks at 320px and 390px');
 }finally{server.close()}
})().catch(err=>{console.error(err.stack);process.exitCode=1});
