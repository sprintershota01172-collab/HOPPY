// HOPPY: house-selection standards remain visible, editable and offline-persistent.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8'),store={};let counter=0,now=1000;
class FakeDate extends Date{static now(){return now+=2000;}}
const run=()=>{
 const events={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
   addEventListener(type,fn){events[type]=fn},contains(){return true},insertAdjacentHTML(){}};
 const win={matchMedia(){return{matches:true}},crypto:{randomUUID(){return String(++counter)}},addEventListener(){}};
 vm.runInNewContext(source,{document:{getElementById(){return app}},window:win,
  localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
  navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,
  crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
 const click=(act,value='')=>events.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
 const input=(value)=>events.input({target:{dataset:{homeAxisMemo:''},value}});
 return {app,click,input};
};
const a=run();
a.click('tab','memo');
assert.match(a.app.innerHTML,/家選びで忘れたくないこと/);
assert.match(a.app.innerHTML,/home-axis-preview/);
a.click('home-axis-toggle');
assert.match(a.app.innerHTML,/data-home-axis-memo/);
const memo='予算4,400万円以内\n通勤と災害リスク\n断熱・維持費も比較';
a.input(memo);
assert.equal(JSON.parse(store['hoppy-phase1-v1']).homeCriteriaMemo,memo);
a.click('home-axis-toggle');
assert.match(a.app.innerHTML,/予算4,400万円以内/);
assert.match(a.app.innerHTML,/通勤と災害リスク/);
const b=run();
b.click('tab','memo');
assert.match(b.app.innerHTML,/予算4,400万円以内/,'memo persisted between app launches');
b.click('home-axis-toggle');
assert.match(b.app.innerHTML,/data-home-axis-memo/);
assert.match(b.app.innerHTML,/断熱・維持費も比較/);
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.home-axis-card\s*\{/);
assert.match(css,/\.home-axis-edit textarea\s*\{[^}]*font-size:16px/);
console.log('HOPPY house selection memo: visible, editable and persistent PASS');
