// Release notes remain reachable from the sixth main tab even when offline.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const events={},storage={},app={
  innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
  contains(){return true},addEventListener(name,fn){events[name]=fn},insertAdjacentHTML(){}
};
let tick=1000,seq=0;
class Clock extends Date{static now(){return tick+=2000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(source,{
  document:{getElementById(){return app}},window:win,
  localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
  navigator:{},location:{protocol:'http:',hostname:'test.invalid'},
  Date:Clock,crypto:win.crypto,confirm(){return true},
  setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='')=>events.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
assert.match(app.innerHTML,/data-value="updates"/,'updates available from the bottom nav');
click('tab','updates');
assert.match(app.innerHTML,/updates-screen/);
assert.match(app.innerHTML,/更新履歴/);
assert.match(app.innerHTML,/r34/);
assert.match(app.innerHTML,/内訳欄を拡大/);
assert.match(app.innerHTML,/現在の版/);
click('tab','sim');
for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/fp-month-report/);
assert.match(app.innerHTML,/fp-build-stamp[^>]*>r34/);
click('tab','updates');
assert.match(app.innerHTML,/r33/);
console.log('HOPPY version-history tab, navigation and visible r34 build identity: PASS');
