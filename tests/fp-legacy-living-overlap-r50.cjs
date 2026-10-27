// r50: cash-flow diagnosis for old overall living allowance plus detailed expenses.
// Never erase an existing household expense without user confirmation.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app.js','utf8');
const hook='  save();render();\n  // The startup wordmark';
assert.ok(src.includes(hook));
const patched=src.replace(hook,'  window.__diag50={state,ui,fpBudget,fpMortgageCapacityCard,fpCalculationData,modelYears};\n'+hook);
const listeners={},store={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},addEventListener(k,fn){listeners[k]=fn},insertAdjacentHTML(){}};
let seq=0,now=1000,confirmNext=false,confirmed=0;
class FakeDate extends Date{static now(){return now+=3000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return 'id-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(patched,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'example.invalid'},
 Date:FakeDate,crypto:win.crypto,confirm(){confirmed++;return confirmNext},
 setTimeout(){return 0},clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__diag50,p=api.state.plan;
assert.equal(p.livingMonthly,0,'new homes must NOT silently add 200,000 yen on top of individual costs');
Object.assign(p,{husbandMonthly:25.5,wifeMonthly:25,wifeReduced:12.5,children:2,firstChildYear:2028,purchaseYear:2028,foodMonthly:2.8,electricityMonthly:1,livingMonthly:20,carMonthly:1.18,cashBufferMonthly:3});
let b=api.fpBudget();
assert.equal(b.possibleLivingOverlap,true,'stored 200k catch-all plus individual spending flagged');
assert.equal(b.legacyOtherLiving,20);
assert.ok(b.itemizedLiving>=3.8,'food and electricity fully counted');
api.ui.fpCalcPage=1;
const calc=api.fpCalculationData(p.propertyPrice,api.modelYears(p.propertyPrice,true));
assert.match(calc,/生活費の二重登録に注意/);
assert.match(calc,/data-act="fp-clear-legacy-living"/);
const oldPayment=b.basicLoanPayment;
const click=(action,value='')=>listeners.click({target:{closest(){return{dataset:{act:action,value}}}},preventDefault(){}});
click('tab','sim');for(let k=0;k<7;k++)click('sim-next');
click('fp-capacity-basis');
click('fp-clear-legacy-living');
assert.equal(p.livingMonthly,20,'declined confirmation leaves household expenses untouched');
assert.equal(confirmed,1);
confirmNext=true;
click('fp-clear-legacy-living');
assert.equal(p.livingMonthly,0,'accepted confirmation clears ONLY the catch-all expense');
assert.equal(p.foodMonthly,2.8);
assert.equal(p.electricityMonthly,1);
b=api.fpBudget();
assert.equal(b.possibleLivingOverlap,false);
assert.ok(b.basicLoanPayment>oldPayment+15,'removing duplicated 200k increases safe mortgage headroom');
assert.ok(api.fpMortgageCapacityCard().includes('借入参考額'));
assert.ok(b.basicAmount>0&&Number.isFinite(b.basicAmount));
console.log('HOPPY r50: legacy 200k overlap flagged, user confirmation required, safe recalculation PASS');
