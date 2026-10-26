// An optional real-browser clipping check at two iPhone-size viewports.
const assert=require('node:assert/strict'),fs=require('node:fs'),
 vm=require('node:vm'),os=require('node:os'),path=require('node:path'),
 cp=require('node:child_process'),url=require('node:url');
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium',
 '/usr/bin/chromium-browser','/opt/google/chrome/chrome'].find(fs.existsSync);
if(!chrome){
 console.log('FP iPhone-sized viewport regression: skipped (Chrome not installed)');
 process.exit(0);
}
const listeners={},storage={};let seq=0,clock=1000;
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},insertAdjacentHTML(){},addEventListener(n,fn){listeners[n]=fn}};
class MockDate extends Date{static now(){return clock+=2000}}
const win={matchMedia(){return {matches:false}},
 crypto:{randomUUID(){return 'r-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'example.invalid'},
 Date:MockDate,crypto:win.crypto,confirm(){return true},
 setTimeout(){return 0},clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='')=>listeners.click({
 target:{closest(){return {dataset:{act,value}}}},preventDefault(){}
});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/fp-month-report/);
assert.match(app.innerHTML,/fp-capacity-example/);
assert.doesNotMatch(app.innerHTML,/fp-month-bar/);
const css=fs.readFileSync('styles.css','utf8');
const browserCode=[
 '<script>window.addEventListener("load",()=>{',
 'const q=s=>document.querySelector(s);',
 'const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();',
 'return {top:b.top,bottom:b.bottom,height:b.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}};',
 'const m={main:r(q("main.main")),capacity:r(q(".fp-capacity-card")),',
 'footnote:r(q(".fp-capacity-footnote")),actual:r(q(".fp-capacity-example")),',
 'hero:r(q(".fp-month-surplus")),heroSmall:r(q(".fp-month-surplus small")),',
 'education:r(q(".fp-education-card")),educationInput:r(q(".fp-education-input input")),',
 'educationMonthly:r(q(".fp-education-out>strong")),educationFootnote:r(q(".fp-education-footnote")),',
 'panel:r(q(".fp-breakdown-panel")),lastRow:r(Array.from(document.querySelectorAll(".fp-breakdown-panel .fp-breakdown-row:not([hidden])")).at(-1)),',
 'pie:r(q(".fp-month-pie")),year:r(q(".fp-year-select")),heroCard:r(q(".fp-month-hero")),',
 'quick:r(q(".fp-month-quick")),educationCard:r(q(".fp-education-card")),',
 'visibleRows:Array.from(document.querySelectorAll(".fp-breakdown-panel .fp-breakdown-row:not([hidden])")).length,',
 'breakdownOverflow:q(".fp-breakdown-list")?.scrollHeight-q(".fp-breakdown-list")?.clientHeight,',
 'nav:r(q("nav.bottom"))};',
 'document.documentElement.setAttribute("data-layout",encodeURIComponent(JSON.stringify(m)));',
 '});</script>'
].join('');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hoppy-visual-'));
try{
 for(const [width,height] of [[390,844],[353,768]]){
  const html='<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
   '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+
   '<style>'+css+'</style>'+
   '<style>.app-shell>.main:has(.fp-focus){padding-top:42px!important}</style></head>'+
   '<body><div id="app" class="app-shell">'+app.innerHTML+'</div>'+browserCode+'</body></html>';
  const p=path.join(tmp,'page-'+width+'.html');fs.writeFileSync(p,html);
  const result=cp.spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--no-first-run','--force-device-scale-factor=1',
    '--window-size='+width+','+height,'--virtual-time-budget=700','--dump-dom',
    url.pathToFileURL(p).href],{encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
  if(result.error)throw result.error;
  const match=(result.stdout||'').match(/data-layout="([^"]+)"/);
  assert.ok(match,'Browser did not report bounds: '+(result.stderr||'').slice(-300));
  const m=JSON.parse(decodeURIComponent(match[1]));
  const inside=(label,parent,child)=>assert.ok(parent&&child&&
     child.top>=parent.top-3&&child.bottom<=parent.bottom+3,
     label+' clipped at '+width+'x'+height+': '+JSON.stringify({parent,child}));
  inside('Mortgage note',m.capacity,m.footnote);
  inside('Actual payment',m.capacity,m.actual);
  inside('Monthly surplus sublabel',m.hero,m.heroSmall);
  inside('Education premium input',m.education,m.educationInput);
  inside('Education total premium',m.education,m.educationMonthly);
  inside('Education insurance explanation',m.education,m.educationFootnote);
  inside('Last expense row',m.panel,m.lastRow);
  assert.ok(m.panel.height<=145,'breakdown must fit on a single screen: '+JSON.stringify(m.panel));
  assert.ok(m.panel.height>=75,'breakdown remains tappable: '+JSON.stringify(m.panel));
  assert.ok(m.visibleRows>=1,'all nonzero expense entries remain visible on the one card');
  assert.ok(m.visibleRows<=30,'compact detail stays responsive');
  assert.ok(m.breakdownOverflow<=1,'breakdown must not scroll');
  assert.ok(m.pie&&m.pie.height>=76,'compact donut stays visible on a short iPhone: '+JSON.stringify(m.pie));
  inside('Whole detail panel',m.main,m.panel);
  assert.ok(m.main.bottom<=m.nav.top+3,'Content must not overlap bottom navigation');
  console.log('HOPPY viewport '+width+'x'+height+': visible panels PASS');
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
