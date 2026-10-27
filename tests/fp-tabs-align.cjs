// Screenshot-derived top baseline test: all eight FP tabs must share the
// same fixed toolbar, tab row and content origin, without vertical jumping.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),
 os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),url=require('node:url');
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium',
 '/usr/bin/chromium-browser','/opt/google/chrome/chrome'].find(fs.existsSync);
const handlers={},store={};let seq=0,clock=1000;
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 addEventListener(k,fn){handlers[k]=fn},contains(){return true},insertAdjacentHTML(){}};
class TestDate extends Date{static now(){return clock+=3000}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return 'tab-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},
 Date:TestDate,crypto:win.crypto,confirm(){return true},setTimeout(){return 0},
 clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='')=>handlers.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
const pages=[];
for(let tab=0;tab<8;tab++){
 click('fp-result-tab',String(tab));
 assert.match(app.innerHTML,/fp-report-screen/,'result tab '+tab+' loaded');
 assert.match(app.innerHTML,/fp-result-nav/);
 assert.match(app.innerHTML,/sim-intro/);
 pages.push({tab,html:app.innerHTML});
}
if(!chrome){
 console.log('HOPPY FP top baseline: DOM structure PASS; Chrome not installed');
 process.exit(0);
}
const css=fs.readFileSync('styles.css','utf8'),
 tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hoppy-align-'));
const measurement=[
 '<script>window.addEventListener("load",()=>{',
 'const r=s=>{const e=document.querySelector(s);if(!e)return null;',
 'const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height}};',
 'const m={intro:r(".fp-report-screen > .sim-intro"),',
 'nav:r(".fp-report-screen > .fp-result-nav"),',
 'content:r(".fp-report-screen > .grow"),',
 'screen:r(".fp-report-screen")};',
 'document.documentElement.setAttribute("data-fp-top",encodeURIComponent(JSON.stringify(m)));',
 '});</script>'
].join('');
try{
 const measurements=[];
 for(const pg of pages){
  const html='<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+
    '<style>'+css+'</style>'+
    '<style>.app-shell>.main{padding-top:42px!important}'+
    '.app-shell>.main:has(.fp-report-screen){padding-top:42px!important}</style>'+
    '</head><body><div id="app" class="app-shell">'+pg.html+'</div>'+measurement+'</body></html>';
  const fp=path.join(tmp,'page-'+pg.tab+'.html');fs.writeFileSync(fp,html);
  const res=cp.spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--no-first-run','--force-device-scale-factor=1',
    '--window-size=390,844','--virtual-time-budget=500','--dump-dom',
    url.pathToFileURL(fp).href],{encoding:'utf8',timeout:20000,maxBuffer:20*1024*1024});
  if(res.error)throw res.error;
  const match=(res.stdout||'').match(/data-fp-top="([^"]+)"/);
  assert.ok(match,'browser must report bounding rectangles for '+pg.tab);
  const bounds=JSON.parse(decodeURIComponent(match[1]));
  for(const key of ['intro','nav','content'])assert.ok(bounds[key]&&Number.isFinite(bounds[key].top),
    'visible '+key+' on page '+pg.tab);
  measurements.push({tab:pg.tab,...bounds});
 }
 const baseline=measurements[0];
 for(const current of measurements){
  for(const name of ['intro','nav','content']){
   assert.ok(Math.abs(current[name].top-baseline[name].top)<1.5,
     'FP tab top misaligned: tab='+current.tab+' '+name+' '+JSON.stringify({
      baseline:baseline[name],actual:current[name]}));
  }
  assert.ok(Math.abs(current.nav.height-33)<1,'FP tab header row is always 33px');
  assert.ok(Math.abs(current.intro.height-29)<1,'FP action row is always 29px');
 }
 console.log('HOPPY FP tabs: 8/8 identical action, nav and content top edges (Chrome) PASS');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
