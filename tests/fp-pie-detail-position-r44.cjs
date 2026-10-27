// r44: the monthly pie / detail buttons must switch ONLY the contents
// of their SVG, never the position or height of the report cards.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),
 os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),url=require('node:url');
const chrome=['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser','/opt/google/chrome/chrome'].find(fs.existsSync);
const events={},store={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 addEventListener(k,v){events[k]=v},contains(){return true},insertAdjacentHTML(){}};
let seq=0,now=1000;
class FixedClock extends Date{static now(){return now+=1000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return 'r44-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FixedClock,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='')=>events.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
click('tab','sim');
for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/fp-month-report/);
const pie=app.innerHTML;
assert.match(pie,/data-fp-month-pie/);
assert.match(pie,/fp-breakdown-panel/);
click('fp-month-view','detail');
const detail=app.innerHTML;
assert.doesNotMatch(detail,/data-fp-month-pie/);
assert.match(detail,/data-fp-detail-view/);
assert.match(detail,/fp-month-donut-detail/);
assert.match(detail,/fp-breakdown-panel/);
assert.match(detail,/fp-month-pie-legend/);
click('fp-month-view','pie');
assert.match(app.innerHTML,/data-fp-month-pie/);
assert.doesNotMatch(app.innerHTML,/data-fp-detail-view/);
if(!chrome){console.log('Monthly pie/detail common slots PASS (Chrome unavailable)');process.exit(0);}
const css=fs.readFileSync('styles.css','utf8');
const probe=[
 '<script>window.addEventListener("load",()=>{',
 'const r=s=>{const e=document.querySelector(s);if(!e)return null;',
 'const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom}};',
 'const m={year:r(".fp-year-select"),loan:r(".fp-capacity-card"),',
 'month:r(".fp-month-head"),balance:r(".fp-month-surplus"),summary:r(".fp-month-summary"),',
 'pie:r(".fp-month-pie"),graphic:r(".fp-month-donut"),legend:r(".fp-month-pie-legend"),',
 'panel:r(".fp-breakdown-panel"),title:r(".fp-breakdown-title"),',
 'list:r(".fp-breakdown-list"),nav:r("nav.bottom"),',
 'report:r(".fp-month-report")};',
 'document.documentElement.setAttribute("data-r44",encodeURIComponent(JSON.stringify(m)));',
 '});</script>'
].join('');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hoppy-r44-'));
function measure(markup,w,h,which){
 const html='<!doctype html><html lang="ja"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'+
 '<style>'+css+'</style>'+
 '<style>.app-shell>.main:has(.fp-focus){padding-top:42px!important}</style></head>'+
 '<body><div class="app-shell" id="app">'+markup+'</div>'+probe+'</body></html>';
 const file=path.join(dir,which+'-'+w+'-'+h+'.html');fs.writeFileSync(file,html);
 const out=cp.spawnSync(chrome,['--headless','--no-sandbox','--disable-dev-shm-usage',
   '--disable-gpu','--no-first-run','--force-device-scale-factor=1',
   '--window-size='+w+','+h,'--virtual-time-budget=700','--dump-dom',
   url.pathToFileURL(file).href],{encoding:'utf8',timeout:60000,maxBuffer:20*1024*1024});
 if(out.error)throw out.error;
 const match=(out.stdout||'').match(/data-r44="([^"]+)"/);
 assert.ok(match,'Missing browser bounds '+which+': '+(out.stderr||'').slice(-250));
 return JSON.parse(decodeURIComponent(match[1]));
}
try{
 for(const [w,h] of [[414,896],[390,844],[353,768]]){
  const a=measure(pie,w,h,'pie'),b=measure(detail,w,h,'detail');
  for(const part of ['year','loan','month','balance','summary','pie','graphic','legend','panel','title','list']){
   assert.ok(a[part]&&b[part],part+' missing on '+w+'x'+h);
   for(const coord of ['x','y','w','h']){
    assert.ok(Math.abs(a[part][coord]-b[part][coord])<=1,
     'pie/detail shift '+part+'.'+coord+' on '+w+'x'+h+': '+JSON.stringify({pie:a[part],detail:b[part]}));
   }
  }
  for(const [view,m] of [['pie',a],['detail',b]]){
   assert.ok(m.panel.bottom<=m.nav.y+3,view+' card overlaps bottom bar');
   assert.ok(m.panel.y>=m.pie.bottom+3,view+' detail overlaps graphic');
  }
  console.log('r44 '+w+'x'+h+': pie and detail cards have identical positions PASS');
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
