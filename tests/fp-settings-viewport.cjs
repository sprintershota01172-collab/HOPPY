// Compact Settings page must keep every control on-screen on iPhone viewports.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),
 os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),url=require('node:url');
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(fs.existsSync);
const storage={},handlers={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},addEventListener(name,fn){handlers[name]=fn},insertAdjacentHTML(){}};
let clock=1000,seq=0;
class DateStub extends Date{static now(){return clock+=2200;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},
 Date:DateStub,crypto:win.crypto,confirm(){return true},setTimeout(){return 0},
 clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='')=>handlers.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');click('fp-result-tab','7');
assert.match(app.innerHTML,/fp-settings-report/);
assert.match(app.innerHTML,/fp-setting-card/);
if(!chrome){console.log('HOPPY FP settings DOM check PASS (no Chrome)');process.exit(0);}
const css=fs.readFileSync('styles.css','utf8');
const probe=[
 '<script>window.addEventListener("load",()=>{',
 'const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{top:b.top,bottom:b.bottom,height:b.height}};',
 'const q=s=>document.querySelector(s);',
 'const m={page:r(q(".fp-settings-report")),screen:r(q(".fp-report-screen")),nav:r(q("nav.bottom")),',
 'cards:Array.from(document.querySelectorAll(".fp-setting-card")).map(r),',
 'inputs:Array.from(document.querySelectorAll(".fp-setting-input input")).map(r),',
 'bottom:r(q(".fp-setting-back")),outcome:r(q(".fp-setting-outcome")),',
 'top:r(q(".fp-settings-heading"))};',
 'document.documentElement.setAttribute("data-layout",encodeURIComponent(JSON.stringify(m)));',
 '});</script>'
].join('');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hoppy-fp-settings-'));
try{
 for(const [width,height] of [[414,896],[390,844],[353,768]]){
  const html='<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+
   '<style>'+css+'</style>'+
   '<style>.app-shell>.main{padding-top:42px!important}'+
   '.app-shell>.main:has(.fp-report-screen){padding-top:42px!important}</style></head>'+
   '<body><div id="app" class="app-shell">'+app.innerHTML+'</div>'+probe+'</body></html>';
  const file=path.join(tmp,'page-'+width+'.html');fs.writeFileSync(file,html);
  const run=cp.spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--no-first-run','--force-device-scale-factor=1',
   '--window-size='+width+','+height,'--virtual-time-budget=700','--dump-dom',
   url.pathToFileURL(file).href],{encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
  if(run.error)throw run.error;
  const match=(run.stdout||'').match(/data-layout="([^"]+)"/);
  assert.ok(match,'Chrome returned no bounds: '+(run.stderr||'').slice(-200));
  const m=JSON.parse(decodeURIComponent(match[1]));
  const inside=(label,p,c)=>assert.ok(p&&c&&c.top>=p.top-3&&c.bottom<=p.bottom+3,
    label+' clipped '+width+'x'+height+' '+JSON.stringify({parent:p,child:c}));
  assert.equal(m.cards.length,3,'three compact settings cards');
  for(let i=0;i<m.cards.length;i++)inside('Settings card '+i,m.page,m.cards[i]);
  for(let i=0;i<m.inputs.length;i++)inside('Settings input '+i,m.page,m.inputs[i]);
  inside('Outcome',m.page,m.outcome);
  inside('Back to monthly',m.page,m.bottom);
  inside('Settings panel',m.screen,m.page);
  assert.ok(m.page.bottom<=m.nav.top+3,'settings must not overlap bottom tab bar');
  console.log('HOPPY FP settings '+width+'x'+height+': all inputs visible PASS');
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
