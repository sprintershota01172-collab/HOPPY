// FP r18: monthly / annual surplus must be relative to income.
// Interest-inclusive displayed cost = down payment + all scheduled payments.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let script=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(script.includes(anchor));
script=script.replace(anchor,
  "  window.__surplusTest={state,ui,fpBudget,fpSurplusStrip,fpMortgageCapacityCard,fpLoanSummary,mortgageMonthly,fpYen,fpMonthlyLedger,modelYears};\n"+anchor);
const listeners={},store={};let seq=0,tick=1000;
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return[]},contains(){return true},
  insertAdjacentHTML(){},addEventListener(name,fn){listeners[name]=fn}};
class Clock extends Date{static now(){return tick+=2000}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return 'test-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(script,{document:{getElementById(){return app}},window:win,
  localStorage:{getItem(key){return store[key]||null},setItem(key,value){store[key]=value}},
  navigator:{},location:{protocol:'http:',hostname:'example.invalid'},
  Date:Clock,crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const api=win.__surplusTest,p=api.state.plan;
Object.assign(p,{children:0,husbandMonthly:40,wifeMonthly:30,wifeReduced:20,husbandBonus:0,wifeBonus:0,
 foodMonthly:3.5,livingMonthly:7,purchaseYear:2028,purchaseMonth:9,
 propertyPrice:4400,downPayment:100,interest:1.5,loanYears:35,
 otherSavingsMonthly:3,otherInvestMonthly:0,nisaMonthly:3,
 weddingCost:0,honeymoonCost:0,events:[],expenses:[]});
const budget=api.fpBudget(),payments=Math.max(12,Math.round(budget.loanYears*12)),
  principal=Math.max(0,budget.amount-budget.downPayment),
  monthlyPayment=api.mortgageMonthly(budget.amount,budget.downPayment,budget.rate,budget.loanYears),
  interestInclusive=Math.min(budget.amount,budget.downPayment)+monthlyPayment*payments,
  interest=Math.max(0,interestInclusive-budget.amount);
assert.ok(interest>0,'positive interest rate produces loan interest');
const card=api.fpMortgageCapacityCard();
assert.ok(card.includes('（金利込み総支払額 '+api.fpYen(interestInclusive)+'）'),
  'purchase price has correctly calculated parenthetical interest-inclusive total');
assert.ok(card.includes('利息総額 '+api.fpYen(interest)));
assert.ok(card.includes('維持費・諸費用'),'non-loan costs are explicitly excluded');
assert.ok(card.includes('金利一定'),'full-term payment assumes constant interest');
assert.ok(card.includes(api.fpYen(budget.amount)));
assert.ok(card.includes(api.fpYen(principal)));
const selectedLoan=api.fpLoanSummary(4400),
  propertyPayment=api.mortgageMonthly(4400,100,1.5,35),
  propertyTotal=100+propertyPayment*35*12;
assert.ok(selectedLoan.includes('（頭金込み総支払額 '+api.fpYen(propertyTotal)+'）'));
p.interest=0;
const noInterest=api.fpBudget(),
  noInterestCard=api.fpMortgageCapacityCard();
assert.ok(noInterestCard.includes('（金利込み総支払額 '+api.fpYen(noInterest.amount)+'）'),
  'at zero interest, total inclusive of down payment equals shown property price');
p.interest=1.5;
const positive=api.fpSurplusStrip(50,10,'2026年');
assert.ok(positive.includes('+100,000円'));
assert.ok(positive.includes('手取り比 +20.0%'));
assert.ok(positive.includes('収入から残るプラス'));
const negative=api.fpSurplusStrip(50,-5,'2026年');
assert.ok(negative.includes('-50,000円'));
assert.ok(negative.includes('手取り比 -10.0%'));
assert.ok(negative.includes('収入に対する不足'));
const none=api.fpSurplusStrip(0,-10,'2026年');
assert.ok(none.includes('手取り比 —'),'zero income does not divide by zero');
const click=(act,value='')=>listeners.click({
  target:{closest(){return {dataset:{act,value}}}},preventDefault(){}
});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.ok(app.innerHTML.includes('fp-month-surplus'));
assert.ok(app.innerHTML.includes('収入から残るプラス'));
assert.ok(app.innerHTML.includes('手取り収入に対する割合'));
assert.ok(app.innerHTML.includes('fp-capacity-interest'));
assert.ok(!app.innerHTML.includes('<h2 class="sim-result-title">'),'monthly page has no duplicate tab heading');
const selectedMonth=api.fpMonthlyLedger(api.modelYears(p.propertyPrice,true).points[0]).months[0],
  monthRatio=selectedMonth.income>0?(selectedMonth.net/selectedMonth.income*100):null,
  expectedMonthRatio=monthRatio===null?'—':(monthRatio>0?'+':'')+monthRatio.toFixed(1)+'%';
assert.ok(app.innerHTML.includes(expectedMonthRatio),'month surplus fraction is derived from selected income');
click('fp-result-tab','0');
assert.ok(app.innerHTML.includes('fp-surplus-strip'),'summary highlights surplus');
assert.ok(!app.innerHTML.includes('<h2 class="sim-result-title">'),'summary has no duplicate heading');
click('fp-result-tab','3');
assert.ok(app.innerHTML.includes('fp-surplus-strip'),'annual forecast shows net surplus');
assert.ok(!app.innerHTML.includes('<h2 class="sim-result-title">'),'annual chart has no duplicate heading');
for(const tab of ['2','4','5','6']){
  click('fp-result-tab',tab);
  assert.ok(!app.innerHTML.includes('<h2 class="sim-result-title">'),'tab '+tab+' has no redundant title');
}
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-surplus-strip\s*\{/);
assert.match(css,/\.fp-capacity-cell\.price>\.fp-capacity-interest\s*\{/);
assert.match(css,/\.fp-report-screen>\.sim-result-title\s*\{display:none!important/);
console.log('HOPPY r18 surplus %, negative handling, title-less tabs and interest-inclusive price: PASS');
