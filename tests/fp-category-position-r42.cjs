// r42: selecting different allocation categories must never move the pie,
 // the detail card, or the first detail row.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),
 os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),url=require('node:url');
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/opt/google/chrome/chrome'].find(fs.existsSync);
const listeners={},store={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 addEventListener(n,fn){listeners[n]=fn},contains(){return true},insertAdjacentHTML(){}};
let tick=1000,seq=0;
class FakeDate extends Date{static now(){return tick+=2000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='',period='')=>listeners.click({target:{closest(){return{dataset:{act,value,period}}}},preventDefault(){}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/fp-friend-brand/);
const categories=['living','housing','education','investing','remaining'];
const pages=categories.map(category=>{
 click('fp-breakdown-select',category,'monthly');
 assert.ok(app.innerHTML.includes('data-fp-category="'+category+'"'),category);
 return {category,html:app.innerHTML};
});
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/Hiragino Maru Gothic ProN/);
assert.match(css,/FP r42: immutable coordinates/);
if(!chrome){console.log('HOPPY FP stable category coordinates DOM PASS (Chrome unavailable)');process.exit(0);}
const measure=[
 '<script>window.addEventListener("load",()=>{',
 'const r=s=>{const el=document.querySelector(s);if(!el)return null;',
 'const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}};',
 'const m={report:r(".fp-month-report"),pie:r(".fp-month-pie"),donut:r(".fp-month-donut"),',
 'panel:r(".fp-breakdown-panel"),title:r(".fp-breakdown-title"),',
 'list:r(".fp-breakdown-list"),first:r(".fp-breakdown-row"),',
 'main:r("main.main"),nav:r("nav.bottom")};',
 'document.documentElement.setAttribute("data-stability",encodeURIComponent(JSON.stringify(m)));',
 '});</script>'
].join('');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hoppy-r42-'));
try{
 for(const [w,h] of [[390,844],[353,768]]){
  const layouts=[];
  for(const pg of pages){
   const html='<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+
    '<style>'+css+'</style>'+
    '<style>.app-shell>.main:has(.fp-focus){padding-top:42px!important}</style></head>'+
    '<body><div id="app" class="app-shell">'+pg.html+'</div>'+measure+'</body></html>';
   const file=path.join(tmp,pg.category+'-'+w+'.html');fs.writeFileSync(file,html);
   const result=cp.spawnSync(chrome,['--headless','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--no-first-run','--force-device-scale-factor=1',
    '--window-size='+w+','+h,'--virtual-time-budget=600','--dump-dom',
    url.pathToFileURL(file).href],{encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
   if(result.error)throw result.error;
   const match=(result.stdout||'').match(/data-stability="([^"]+)"/);
   assert.ok(match,'missing browser data for '+pg.category+': '+(result.stderr||'').slice(-150));
   const data=JSON.parse(decodeURIComponent(match[1]));
   assert.ok(data.panel&&data.first&&data.pie&&data.list,'visible layout for '+pg.category);
   assert.ok(data.panel.bottom<=data.nav.y+3,'detail card must not overlap navigation');
   layouts.push({category:pg.category,...data});
  }
  const ref=layouts[0];
  for(const actual of layouts){
   for(const part of ['pie','donut','panel','title','list']){
    for(const coord of ['x','y','width','height']){
     assert.ok(Math.abs(ref[part][coord]-actual[part][coord])<1.1,
       'category '+actual.category+' shifted '+part+'.'+coord+
       ' at '+w+'x'+h+': '+JSON.stringify({expected:ref[part],actual:actual[part]}));
    }
   }
   assert.ok(Math.abs(actual.first.y-actual.list.y)<12,'first row remains top anchored');
  }
  console.log('HOPPY '+w+'x'+h+': five categories share exact chart and detail coordinates PASS');
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
