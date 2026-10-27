// r47: peak university bills must not zero-out an affordable regular mortgage
// when they can be prepared through earlier monthly education reserves.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app.js','utf8');
const at='  save();render();\n  // The startup wordmark';
assert.ok(src.includes(at));
const js=src.replace(at,'  window.__cash47={state,ui,fpBudget,fpMortgageCapacityCard,fpCalculationData,modelYears,fpYen};\n'+at);
const storage={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},addEventListener(){},insertAdjacentHTML(){}};
const win={crypto:{randomUUID(){return 'fixed-id'}},matchMedia(){return{matches:false}},addEventListener(){}};
vm.runInNewContext(js,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'test.invalid'},Date,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},
 clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__cash47,p=api.state.plan;
Object.assign(p,{
 husbandMonthly:42,wifeMonthly:25,wifeReduced:18,children:2,
 firstChildYear:2029,birthInterval:3,highSchool:'public',university:'private',
 purchaseYear:2028,propertyPrice:4200,loanYears:35,interest:1.6,
 cashBufferMonthly:3,goalCashEnabled:0,otherSavingsMonthly:3,
 nisaMonthly:3,otherInvestMonthly:0,
 foodMonthly:4,livingMonthly:6,freeSpendingMonthly:3,
 housingOngoing:2.5,annualTax:0,carTaxAnnual:0,travelAnnual:0,annualEvents:0,
 childEducationInsuranceMonthly:1,childLivingMonthly:1,daycareMonthly:1
});
const b=api.fpBudget();
assert.ok(b.schoolPeak>b.schoolReserve,'tuition peak exceeds smoothed required fund');
assert.ok(b.schoolReserve>0,'positive monthly education reserve');
assert.ok(b.loanPayment>0,'school peak does not force the steady-state monthly mortgage to zero');
const rawWorst=Math.min(...b.years.map(row=>row.balanceCap));
assert.ok(rawWorst<b.balanceCap,
 'the highest individual school-year bill is treated separately from ongoing cost');
assert.equal(b.housingBudget,Math.max(0,b.balanceCap));
assert.equal(b.loanPayment,Math.max(0,b.balanceCap-b.maintenance));
const view=api.fpMortgageCapacityCard();
assert.ok(view.includes(api.fpYen(b.loanPayment)));
assert.match(view,/計算の内訳/);
api.ui.fpCalcPage=1;
const explanation=api.fpCalculationData(p.propertyPrice,api.modelYears(p.propertyPrice,true));
assert.match(explanation,/学校・大学費の月々の備え/);
assert.match(explanation,/学費を月割で準備/);
assert.match(explanation,/ピーク/);
p.livingMonthly+=80;
const impossible=api.fpBudget();
assert.equal(impossible.loanPayment,0,'genuine lasting deficit still returns zero');
assert.ok(impossible.rawLoanPayment<0);
assert.match(api.fpMortgageCapacityCard(),/不足/,'cash shortfall clearly visible instead of unexplained zero');
assert.match(api.fpCalculationData(p.propertyPrice,api.modelYears(p.propertyPrice,true)),/家計の設定条件では月々/);
console.log('FP r47: university peak normalized, positive mortgage baseline, true deficits explained PASS');
