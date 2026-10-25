// FP test suite: affordability, rate shocks, cash reserve and property evaluations.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const store={};let now=0,seq=0;const events={};
class FakeDate extends Date{static now(){now+=1500;return now;}}
const app={
 innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 addEventListener(k,cb){events[k]=cb},contains(){return true},insertAdjacentHTML(){}
};
const context={
 document:{getElementById(){return app}},window:{matchMedia(){return {matches:true}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}},
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'example.invalid'},confirm(){return true},
 setTimeout(){return 0},clearTimeout(){},Date:FakeDate,
 crypto:{randomUUID(){return String(++seq)}},Intl,console,URL,Number,Math,Array,JSON,String,Promise
};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),context,{filename:'app.js'});
const click=(act,value='',extra={})=>events.click({target:{closest(){return {dataset:{act,value,...extra}}}},preventDefault(){}});
const input=(key,value)=>events.input({target:{dataset:key,value,hasAttribute(){return false}}});
const state=()=>JSON.parse(store['hoppy-phase1-v1']);
click('seed');click('tab','sim');
assert.match(app.innerHTML,/ご家族のこれから/);
input({sim:'children'},0);click('sim-next');
input({sim:'husbandMonthly'},40);
input({sim:'wifeMonthly'},35);
input({sim:'husbandBonus'},0);input({sim:'wifeBonus'},0);
click('sim-next');
input({sim:'livingMonthly'},20);
input({sim:'cashSavings'},1000);
input({sim:'support'},0);
input({sim:'carMonthly'},0);
click('sim-next');
input({sim:'interest'},1.5);
input({sim:'housingOngoing'},2.5);
input({sim:'loanYears'},35);
input({sim:'propertyPrice'},3000);
input({sim:'downPayment'},0);
click('sim-next');click('sim-next');
assert.equal(state().plan.hasRun,1);
assert.match(app.innerHTML,/あなたの住宅予算/);
assert.match(app.innerHTML,/無理しない購入価格の目安/);
assert.match(app.innerHTML,/金利＋1％なら/);
assert.match(app.innerHTML,/物件の予算評価/);
click('fp-result-tab','1');
assert.match(app.innerHTML,/貯金の推移/);
assert.match(app.innerHTML,/金利＋1％で/);
assert.match(app.innerHTML,/生活防衛資金/);
click('fp-result-tab','0');
click('fp-open-home',state().properties[0].id);
assert.match(app.innerHTML,/情報を編集/);
click('detail-close');
click('tab','property');
assert.match(app.innerHTML,/fp-card-dot/,'FP budget statuses appear on properties after calculation');
click('tab','sim');click('sim-restart');
assert.match(app.innerHTML,/前回の診断を見る/);
click('fp-view-budget');
assert.match(app.innerHTML,/あなたの住宅予算/);
assert.equal(state().plan.hasRun,1);
console.log('HOPPO FP affordability and Apple budget workflow: PASS');
