// HOPPY mortgage capacity and header-free startup behavior.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(script.includes(anchor),'test hook placement must precede first render');
const source=script.replace(anchor,
  "  window.__affordTest={state,ui,fpBudget,fpForecast,fpMortgageCapacityCard,mortgageMonthly,fpYen,modelYears};\n"+anchor);
const callbacks={},store={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return[]},
  contains(){return true},addEventListener(name,fn){callbacks[name]=fn},insertAdjacentHTML(){}};
let counter=0,clock=1000;
class MockDate extends Date{static now(){return clock+=2000;}}
const win={matchMedia(){return {matches:false}},crypto:{randomUUID(){return 'case-'+(++counter)}},addEventListener(){}};
const ctx={document:{getElementById(){return app}},window:win,
  localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
  navigator:{},location:{protocol:'http:',hostname:'invalid.test'},
  Date:MockDate,crypto:win.crypto,confirm(){return true},
  setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise};
vm.runInNewContext(source,ctx,{filename:'app.js'});
const click=(act,value='')=>callbacks.click({target:{closest(){return {dataset:{act,value}}}},preventDefault(){}});
assert.doesNotMatch(app.innerHTML,/<header class="top/,'no persistent title banner');
assert.match(app.innerHTML,/data-act="settings"/,'settings moved to home');
const api=win.__affordTest,p=api.state.plan;
Object.assign(p,{husbandMonthly:40,wifeMonthly:30,wifeReduced:20,children:0,
  husbandBonus:0,wifeBonus:0,foodMonthly:3.5,livingMonthly:15,
  otherSavingsMonthly:5,otherInvestMonthly:0,nisaMonthly:3,
  cashBufferMonthly:3,housingOngoing:2.5,interest:1.5,
  loanYears:35,downPayment:0,propertyPrice:4400});
const original=api.fpBudget();
assert.ok(original.loanPayment>0,'monthly mortgage budget computed');
assert.ok(original.amount>0,'equivalent housing price computed');
assert.equal(original.loanYears,35);
assert.equal(original.rate,1.5);
assert.ok(Math.abs(original.loanPayment-
 Math.max(0,original.housingBudget-original.maintenance))<1e-8,
 'monthly housing budget deducts maintenance');
assert.ok(Math.abs(api.mortgageMonthly(original.amount,original.downPayment,original.rate,original.loanYears)-original.loanPayment)<.5,
 'rounded target property price uses roughly the affordable loan payment');
assert.ok(api.mortgageMonthly(original.amount,original.downPayment,original.rate,original.loanYears)<=original.loanPayment+1e-8,
 'rounding is conservative');
const card=api.fpMortgageCapacityCard();
assert.match(card,/毎月返せる目安/);
assert.match(card,/借入額の目安/);
assert.match(card,new RegExp(api.fpYen(original.loanPayment)));
assert.match(card,new RegExp(api.fpYen(original.amount)));
assert.match(card,/利息込み返済総額/);
assert.match(card,/計算の内訳/);
assert.match(card,/年の家計で試算/);
assert.match(card,/計算の内訳/);
assert.match(card,/借入額の目安/);
// A household budget limit is not a loan bill. The entered home receives
// a separate amortized payment at the configured loan length and rate.
p.loanYears=50;
p.propertyPrice=4400;
let forFifty=api.fpMortgageCapacityCard();
let actualFifty=api.mortgageMonthly(4400,0,1.5,50);
assert.match(forFifty,/毎月返せる目安/);
assert.match(forFifty,/借入額の目安/);
assert.match(forFifty,/計算の内訳/);
assert.ok(forFifty.includes('物件価格 '+api.fpYen(4400)+' の月返済'));
assert.ok(forFifty.includes(api.fpYen(actualFifty)+' / 月'),
  'chosen property payment is derived from its actual loan size over 50 years');
p.propertyPrice=api.fpBudget().amount*2;
assert.match(api.fpMortgageCapacityCard(),/返済目安を/,'expensive chosen property warns about over-budget payment');
p.propertyPrice=4400;p.loanYears=35;
const prior=original.amount;
p.housingOngoing=4;
assert.ok(api.fpBudget().loanPayment<original.loanPayment,'higher maintenance cuts loan payment');
assert.ok(api.fpBudget().amount<prior,'higher maintenance reduces property price');
p.housingOngoing=2.5;
p.interest=2.5;
assert.ok(api.fpBudget().amount<prior,'higher interest reduces financed home price');
p.interest=1.5;
p.downPayment=400;
assert.equal(api.fpBudget().amount,prior,'zero-down financing keeps home price independent of legacy down payment values');
p.downPayment=0;
p.otherSavingsMonthly=40;
assert.ok(api.fpBudget().amount<prior,'a larger monthly savings goal reduces available housing cash');
p.otherSavingsMonthly=5;

click('tab','sim');
for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/data-fp-cash-month/);
assert.match(app.innerHTML,/fp-capacity-card/);
assert.match(app.innerHTML,/借入額の目安/);
assert.doesNotMatch(app.innerHTML,/<header class="top/);
click('fp-result-tab','0');
assert.match(app.innerHTML,/fp-capacity-card/);
assert.match(app.innerHTML,/住宅ローンの毎月返済/,'existing property repayment card stays');
assert.match(app.innerHTML,/物件の予算評価/);
for(const tab of ['compare','property','memo','schedule']){
 click('tab',tab);
 assert.doesNotMatch(app.innerHTML,/<header class="top/,'no global title on '+tab);
}
click('tab','property');
assert.match(app.innerHTML,/data-act="settings"/);
const html=fs.readFileSync('index.html','utf8'),
  css=fs.readFileSync('styles.css','utf8');
assert.match(html,/id="hoppo-launch"/);
assert.match(html,/ホッポさん/);
assert.doesNotMatch(html,/<div class="boot"[^>]*>[^<]*<strong>ほっぽさん/);
assert.match(css,/@keyframes hoppo-launch-name/);
assert.match(css,/\.hoppo-launch\.is-leaving/);
assert.match(css,/\.app-shell > \.main\s*\{[^}]*safe-area-inset-top/);
console.log('HOPPY capacity: monthly affordable payment → purchase price, finance assumptions, header-free UI, startup mark PASS');
