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
const appSource=fs.readFileSync('app.js','utf8').replace(
 "  save();render();\n  // The startup wordmark",
 "  state.plan.otherInvestMonthly=1;save();render();\n  // The startup wordmark");
vm.runInNewContext(appSource,{
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
listeners.click({target:{closest(){return {dataset:{act:'fp-breakdown-select',value:'investing',period:'monthly'}}}},preventDefault(){}});
assert.match(app.innerHTML,/data-fp-category="investing"/,'investment detail selected');
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
 'panel:r(q(".fp-breakdown-panel")),lastRow:r(q(".fp-breakdown-panel .fp-breakdown-row:last-child")),',
 'pie:r(q(".fp-month-pie")),donut:r(q(".fp-month-donut")),list:r(q(".fp-breakdown-list")),',
 'first:r(q(".fp-breakdown-row:first-child")),second:r(q(".fp-breakdown-row:nth-child(2)")),',
 'category:q(".fp-breakdown-panel")?.dataset.fpCategory,',
 'listScroll:q(".fp-breakdown-list")?.scrollHeight,listClient:q(".fp-breakdown-list")?.clientHeight,',
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
    url.pathToFileURL(p).href],{encoding:'utf8',timeout:45000,maxBuffer:20*1024*1024});
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
  inside('Whole detail panel',m.main,m.panel);
  assert.equal(m.category,'investing','the selected panel is investment breakdown');
  assert.ok(m.pie.height>=90,'donut panel should be enlarged: '+JSON.stringify(m.pie));
  assert.ok(m.donut.height>=86,'SVG donut should be enlarged: '+JSON.stringify(m.donut));
  assert.ok(m.listScroll<=m.listClient+1,'investment detail must not scroll: '+JSON.stringify(m));
  inside('First investment row',m.list,m.first);
  inside('Second investment row',m.list,m.second);
  assert.ok(m.second.left>m.first.left+10,'investment values must occupy top-left anchored columns: '+JSON.stringify({first:m.first,second:m.second,list:m.list,panel:m.panel}));
  assert.ok(m.first.top-m.list.top<10,'investment detail starts at top left, not center');
  assert.ok(m.main.bottom<=m.nav.top+3,'Content must not overlap bottom navigation');
  console.log('HOPPY investor breakdown no-scroll '+width+'x'+height+': enlarged donut and top-left-aligned entries PASS');
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
