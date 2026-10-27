// If requested savings leave only a ¥500,000 borrowing equivalent, the
// app must prominently show the separate basic cost-of-living ceiling.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(source.includes(anchor));
source=source.replace(anchor,"  window.__f={state,fpBudget,fpMortgageCapacityCard};\n"+anchor);
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},addEventListener(){},contains(){return true},insertAdjacentHTML(){}};
const w={crypto:{randomUUID(){return 'fixed'}},matchMedia(){return{matches:false}},addEventListener(){}};
vm.runInNewContext(source,{
 document:{getElementById(){return app}},window:w,
 localStorage:{getItem(){return null},setItem(){}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},crypto:w.crypto,
 Date,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
});
const a=w.__f,p=a.state.plan;
Object.assign(p,{husbandMonthly:40,wifeMonthly:25,wifeReduced:12.5,children:2,
 firstChildYear:2028,birthInterval:3,highSchool:'public',university:'private',
 purchaseYear:2028,loanYears:35,interest:1.5,housingOngoing:2.5,
 foodMonthly:3,livingMonthly:8,freeSpendingMonthly:3,
 nisaMonthly:3,otherInvestMonthly:0,goalNisaEnabled:0,goalOtherEnabled:0,
 goalCashEnabled:0,cashBufferMonthly:3,otherSavingsMonthly:0});
let b=a.fpBudget();
assert.ok(b.basicAmount>100,'enough basic spending margin to test');
const nearFiftyLoanMonth=0.2;
const neededSavings=b.basicRaw-b.schoolTopUp-b.investing-nearFiftyLoanMonth;
assert.ok(neededSavings>0,'can set a high but mathematically permissible savings target');
p.otherSavingsMonthly=neededSavings;
b=a.fpBudget();
assert.ok(b.loanPayment>0&&b.amount<=100,'savings-constrained amount close to 50万円');
assert.ok(b.basicAmount>=b.amount+100,'life essentials support materially larger amount');
const html=a.fpMortgageCapacityCard();
assert.match(html,/生活費優先の借入参考額/);
assert.ok(html.includes('生活費優先の返済上限'));
assert.ok(html.includes('貯金・NISAを続けた場合'));
assert.ok(html.includes('（借入'));
assert.ok(!html.includes('<span>借入額の目安</span>'),
 'a tiny savings-limited loan must not be presented as the sole estimate');
console.log('FP r49: 50万円 is never the only household borrowing amount shown PASS');
