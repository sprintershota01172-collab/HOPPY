// Housing affordability regression: real expense subtraction, optional
// savings separated from essentials, and long-term risks disclosed rather
// than silently changing all visible values to zero.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const marker="  save();render();\n  // The startup wordmark";
assert.ok(source.includes(marker));
source=source.replace(marker,
  "  window.__r48={state,ui,fpBudget,fpHousingYearBudget,fpMortgageCapacityCard,fpCalculationData,modelYears};\n"+marker);
const callbacks={},store={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},addEventListener(k,v){callbacks[k]=v},insertAdjacentHTML(){}};
let time=10000,seq=0;
class TestDate extends Date{static now(){return time+=1000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(source,{
  document:{getElementById(){return app}},window:win,
  localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
  navigator:{},location:{protocol:'http:',hostname:'test.invalid'},
  Date:TestDate,crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__r48,p=api.state.plan;
const set=(x)=>Object.assign(p,x);
set({husbandMonthly:40,wifeMonthly:25,wifeReduced:13,
  children:2,firstChildYear:2029,birthInterval:3,university:'private',highSchool:'private',
  purchaseYear:2028,loanYears:35,interest:1.5,propertyPrice:4000,
  foodMonthly:3,livingMonthly:9,freeSpendingMonthly:3,
  nisaMonthly:4,otherInvestMonthly:1,otherSavingsMonthly:3,
  goalCashEnabled:0,goalNisaEnabled:0,goalOtherEnabled:0,cashBufferMonthly:3,
  housingOngoing:2.5,annualTax:0,annualEvents:0});
let b=api.fpBudget();
assert.ok(b.basicLoanPayment>0,'essentials-first house limit must be positive in representative household');
assert.ok(b.loanPayment>0,'normal savings-compatible amount remains positive in representative household');
assert.ok(b.loanPayment<=b.basicLoanPayment,'savings-compatible payment cannot exceed essentials-first');
assert.ok(b.schoolTopUp>=0&&b.schoolReserve>=b.school,'education top-up avoids counting initial school twice');
assert.ok(b.futureDeficitYears>=0&&Number.isFinite(b.worstSurplus),'future risk separately calculated');
const initialBasic=b.basicLoanPayment,initialPreferred=b.loanPayment;
p.otherSavingsMonthly=60;
b=api.fpBudget();
assert.ok(b.basicLoanPayment===initialBasic,'large elective cash savings must not change necessities-only ceiling');
assert.ok(b.loanPayment===0,'unachievable savings goal can produce a zero recommended amount');
assert.ok(b.preferredRaw<0,'unachievable savings goal must retain raw negative value');
const card=api.fpMortgageCapacityCard();
assert.match(card,/生活費優先の借入参考額/);
assert.ok(card.includes('借入')&&card.includes('積立'),'both reference modes are visible');
assert.match(card,/借入参考額/);
assert.match(card,/貯金・NISAを続けた場合/);
assert.ok(card.includes('fp-capacity-basis'));
api.ui.fpCalcPage=1;
const calc=api.fpCalculationData(p.propertyPrice,api.modelYears(p.propertyPrice,true));
for(const label of ['生活費優先の返済上限','将来の学費準備（追加分）','NISA等の積立・現金貯金','積立と両立できる返済余力'])
  assert.ok(calc.includes(label),label+' shown in transparent calculation');
p.otherSavingsMonthly=3;
const restored=api.fpBudget();
assert.ok(Math.abs(restored.loanPayment-initialPreferred)<1e-8,'restoring target restores suggested mortgage');
p.livingMonthly=110;
b=api.fpBudget();
assert.equal(b.basicLoanPayment,0,'if actual living costs exceed salary, show no invented capacity');
assert.ok(b.basicRaw<0);
assert.match(api.fpMortgageCapacityCard(),/生活費だけで/);
p.livingMonthly=9;
p.nisaMonthly+=2;
const withNisa=api.fpBudget();
assert.ok(withNisa.loanPayment<initialPreferred,'NISA affects preferred payment only');
assert.equal(withNisa.basicLoanPayment,initialBasic);
const expenses=api.fpBudget().years;
assert.ok(expenses.length>=20,'future stress assessed independently');
p.husbandMonthly=0;p.wifeMonthly=0;p.wifeReduced=0;
assert.equal(api.fpBudget().basicLoanPayment,0);
assert.match(api.fpMortgageCapacityCard(),/月手取り0円/);
assert.match(api.fpCalculationData(p.propertyPrice,api.modelYears(p.propertyPrice,true)),/手取り収入を確認/);
console.log('FP r48: positive house budgets, zero diagnostics, optional savings separation, education, long-term stress PASS');
