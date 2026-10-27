// Cash goals reserve future cash, not an additional expense. Mortgage headroom
// must reveal its actual constraints and use exactly one savings input mode.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const hook="  save();render();\n  // The startup wordmark";
assert.ok(source.includes(hook));
source=source.replace(hook,
 "  window.__fp45={plan:state.plan,ui,fpCashGoalMonthly,fpTargetMonthly,fpBudget,fpMonthlyLedger,modelYears,fpMonthlySettingsScreen,fpMortgageCapacityCard,fpCalculationData,fpWizardPages,fpYen};\n"+hook);
const events={},store={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},addEventListener(k,fn){events[k]=fn},insertAdjacentHTML(){}};
let clock=1000,seq=0;
class FakeDate extends Date{static now(){return clock+=2000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(source,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},
 clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__fp45,p=api.plan;
p.children=0;
p.husbandMonthly=30;p.wifeMonthly=20;p.nisaMonthly=3;
p.cashSavings=100;p.support=0;p.otherSavingsMonthly=2;
p.cashBufferMonthly=2;p.goalCashEnabled=0;
p.loanYears=50;p.interest=1.5;p.housingOngoing=2.5;
p.purchaseYear=2028;p.propertyPrice=4300;
assert.equal(api.fpCashGoalMonthly(p),2);
const b=api.fpBudget();
assert.ok(Math.abs(b.balanceCap-(b.monthlyIncome-b.spending-b.investing-b.cashTarget-b.buffer))<1e-8);
assert.ok(Math.abs(b.housingBudget-Math.max(0,b.balanceCap))<1e-8);
assert.ok(Math.abs(b.loanPayment-Math.max(0,b.balanceCap-b.maintenance))<1e-8);
const previousForecast=api.modelYears(p.propertyPrice,true);
const oldExpenses=previousForecast.points.map(x=>x.expenses);
p.goalCashEnabled=1;p.goalCashAmount=220;p.goalCashYears=5;
assert.ok(Math.abs(api.fpCashGoalMonthly(p)-2)<1e-8,'(220-100)/60 is 2 man-yen monthly');
assert.ok(api.fpWizardPages(5)[0].html.includes('data-sim="goalCashAmount"'));
assert.ok(!api.fpWizardPages(5)[0].html.includes('data-sim="otherSavingsMonthly"'));
assert.ok(api.fpWizardPages(5)[1].html.includes('data-sim="nisaMonthly"'));
p.goalNisaEnabled=1;
assert.ok(!api.fpWizardPages(5)[1].html.includes('data-sim="nisaMonthly"'));
assert.ok(api.fpWizardPages(5)[1].html.includes('data-sim="goalNisaAmount"'));
p.goalNisaEnabled=0;
const newExpenses=api.modelYears(p.propertyPrice,true).points.map(x=>x.expenses);
assert.equal(JSON.stringify(newExpenses),JSON.stringify(oldExpenses),'cash target cannot be counted as an expense');
const ref=api.modelYears(p.propertyPrice,true),settings=api.fpMonthlySettingsScreen(ref);
assert.match(settings,/data-fp-cash-goal="enabled"/);
assert.match(settings,/data-fp-cash-goal="amount"/);
assert.match(settings,/計算に使う月額/);
assert.match(settings,/貯金目標を確保した後/);
const basis=api.fpCalculationData(p.propertyPrice,ref);
const budgetHTML=api.fpMortgageCapacityCard();
assert.match(budgetHTML,/fp-capacity-basis/);
assert.ok(budgetHTML.includes(api.fpYen(api.fpBudget().loanPayment)));
api.ui.fpCalcPage=1;
const calc=api.fpCalculationData(p.propertyPrice,ref);
assert.match(calc,/25％/);
assert.match(calc,/現金貯金の目標/);
assert.match(calc,/月々のローン返済に使える額/);
assert.match(calc,/銀行審査とは別/);
const click=(act,value='')=>events.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/毎月の残り/);
assert.match(app.innerHTML,/貯金目標後の余裕/);
click('fp-capacity-basis');
assert.match(app.innerHTML,/住宅予算の計算/);
assert.match(app.innerHTML,/現金貯金の目標/);
console.log('FP r45: goal selection, no cash double-counting, exact mortgage headroom and monthly margin PASS');
