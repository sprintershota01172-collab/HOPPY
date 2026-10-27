// r46: household housing budget is calculated from remaining income after
// living, future school costs, monthly savings and the specified buffer.
// Fixed 25% ratios remain advisory, not a hidden affordability cap.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app.js','utf8');
const anchor='  save();render();\n  // The startup wordmark';
assert.ok(src.includes(anchor));
const code=src.replace(anchor,'  window.__afford46={state,ui,fpBudget,fpHousingYearBudget,fpForecast,fpMortgageCapacityCard,fpCalculationData,fpYearlyIncome,fpBaseMonthly,fpYearPoint,modelYears};\n'+anchor);
const store={},listeners={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},addEventListener(n,fn){listeners[n]=fn},insertAdjacentHTML(){}};
let clock=1000,seq=0;
class Clock extends Date{static now(){return clock+=1800;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(code,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},
 Date:Clock,crypto:win.crypto,confirm(){return true},
 setTimeout(){return 0},clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const a=win.__afford46,p=a.state.plan;
Object.assign(p,{husbandMonthly:45,wifeMonthly:30,children:0,
  livingMonthly:5,foodMonthly:3,electricityMonthly:1,freeSpendingMonthly:2,
  nisaMonthly:2,otherSavingsMonthly:3,goalCashEnabled:0,
  cashBufferMonthly:3,housingOngoing:2.5,purchaseYear:2028,
  interest:1.5,propertyPrice:3400,loanYears:35,firstChildYear:2029});
const noKids=a.fpBudget();
assert.ok(noKids.housingBudget>noKids.ratioCap,
  'household has sufficient cash and is not automatically capped at 25 percent');
assert.equal(noKids.referenceYear,noKids.years[0].year);
assert.ok(Math.abs(noKids.housingBudget-Math.max(0,noKids.balanceCap))<1e-8);
const beforeRent=noKids.housingBudget;
p.rentMonthly=29;p.parkingMonthly=3;
assert.equal(a.fpBudget().housingBudget,beforeRent,
  'rent due to end on purchase must not subtract twice from future owner budget');
p.children=2;p.wifeReduced=12;p.birthInterval=3;
p.university='private';p.highSchool='private';
const family=a.fpBudget();
assert.ok(family.housingBudget<noKids.housingBudget,'education and time-reduced income reduce future housing affordability');
assert.ok(family.years.some(row=>row.school>0),'includes years with school and university costs');
assert.ok(family.referenceYear>=p.purchaseYear,'future year of maximum constraint must be shown');
assert.ok(Math.abs(family.balanceCap-(family.monthlyIncome-family.spending-family.investing-family.cashTarget-family.buffer))<1e-8);
const originalLoan=family.loanPayment;
p.otherSavingsMonthly+=1;
assert.ok(a.fpBudget().loanPayment<originalLoan,'more cash savings reduce mortgage capacity');
p.otherSavingsMonthly-=1;
const originalSchool=family.school;
p.children=0;
assert.ok(a.fpBudget().school<=originalSchool,'no children removes school expenses');
p.children=2;
let calc=a.fpCalculationData(p.propertyPrice,a.modelYears(p.propertyPrice,true));
a.ui.fpCalcPage=1;
calc=a.fpCalculationData(p.propertyPrice,a.modelYears(p.propertyPrice,true));
assert.match(calc,/住宅予算の計算/);
assert.match(calc,/子どもの学校・大学費/);
assert.match(calc,/住宅に使える予算/);
assert.match(calc,/月々のローン返済に使える額/);
assert.match(calc,/25％.*参考比率/);
const card=a.fpMortgageCapacityCard();
assert.match(card,/家賃・住宅費に使える額/);
assert.match(card,/計算の内訳/);
const click=(act,value='')=>listeners.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
click('fp-capacity-basis');
assert.match(app.innerHTML,/最も余裕が少ない/);
assert.match(app.innerHTML,/子どもの学校・大学費/);
console.log('FP r46: household budget, education stress, goal reserves, avoid rent duplication, transparent calculation PASS');
