'use strict';
// Run: node --test tests/finance.test.cjs
// Offline, deterministic tests against the same functions used by the PWA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFinance(){
  const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const marker='\n  save();render();\n  // The startup';
  assert.equal(source.split(marker).length,2,'App test anchor changed');
  const bridge='\n  globalThis.__finance = {state,defaultPlan,fpBudget,fpRating,fpMortgageCapacityCard,mortgageMonthly,modelYears,fpMonthlyLedger,fpEducationFundYears,fpSchoolBreakdown,fpCashGoalForYear,fpAdviceData}; return;\n  // The startup';
  const app={addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
  const ctx={
    document:{getElementById:()=>app,addEventListener(){},querySelectorAll(){return []}},
    window:{matchMedia:()=>({matches:false}),addEventListener(){},crypto:{}},
    localStorage:{getItem:()=>null,setItem(){}},
    navigator:{},location:{protocol:'https:',hostname:'localhost'},
    confirm:()=>false,console
  };
  vm.runInNewContext(source.replace(marker,bridge),ctx,{filename:'app.js',timeout:5000});
  return ctx.__finance;
}
const now=()=>new Date().getFullYear();

test('PMT amount and inverse principal use 10,000-yen units',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+2;
  const b=x.fpBudget();
  assert.ok(b.amount>0);
  assert.ok(Math.abs(x.mortgageMonthly(b.amount,0,p.interest,p.loanYears)-b.loanPayment)<.00001);
  assert.equal(x.mortgageMonthly(4200,0,0,35),4200/(35*12));
});

test('loan payment and borrowing capacity are not displayed as a positive surplus',()=>{
  const x=loadFinance();
  const html=x.fpMortgageCapacityCard();
  assert.match(html,/積立を維持する月返済目安/);
  assert.match(html,/借入参考額/);
  assert.doesNotMatch(html,/返済上限<\/span><strong>\+/);
});

test('temporary childbirth year pay does not become the lifetime payment baseline',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+2;
  assert.equal(x.fpBudget().referenceYear,p.purchaseYear+1);
  p.children=0;
  assert.equal(x.fpBudget().referenceYear,p.purchaseYear);
});

test('no income cannot create loan capacity',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.husbandMonthly=0;p.wifeMonthly=0;p.wifeReduced=0;
  assert.equal(x.fpBudget().amount,0);
});

test('rent is dropped on purchase, but ordinary living expenses remain',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+4;p.children=0;
  const before=x.fpBudget().amount;
  p.rentMonthly=99;
  assert.equal(x.fpBudget().amount,before,'Rent must not be counted after purchase');
  p.foodMonthly+=5;
  assert.ok(x.fpBudget().amount<before,'Food costs must reduce capacity');
});

test('missing essential inputs, and genuine catch-all overlaps, are flagged',()=>{
  const x=loadFinance(),p=x.state.plan;
  assert.ok(x.fpBudget().missingEssentialInputs.length>0);
  p.livingMonthly=20;p.foodMonthly=0;
  assert.equal(x.fpBudget().possibleLivingOverlap,false);
  p.foodMonthly=3;
  assert.equal(x.fpBudget().possibleLivingOverlap,true);
});

test('education age is actual child age, not calendar-year offset',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.firstChildYear=now()+2;p.children=1;
  const grade=x.fpSchoolBreakdown(now()+10)[0];
  assert.equal(grade.age,8);
  assert.equal(grade.stage,'小学校');
});

test('education target accumulates and then offsets tuition, without double withdrawal',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.children=1;p.firstChildYear=now()+2;p.purchaseYear=now()+2;
  p.simulateUntil=now()+24;
  p.goalEduEnabled1=1;p.goalEduAmount1=500;p.goalEduAge1=18;
  const targetYear=p.firstChildYear+18;
  const fund=x.fpEducationFundYears(p,targetYear);
  assert.ok(Math.abs(fund.get(targetYear-1).closing-500)<.03);
  assert.equal(fund.get(targetYear).covered,125);
  assert.ok(Math.abs(fund.get(targetYear).closing-375)<.03);
  const projection=x.modelYears(4400,true);
  const year=projection.points.find(z=>z.year===targetYear);
  assert.ok(year);
  assert.equal(year.fundedSchool,125);
  assert.ok(Math.abs(x.fpMonthlyLedger(year).ending-year.cash)<.000001);
  const b=x.fpBudget(),row=b.years.find(z=>z.year===targetYear);
  assert.ok(Math.abs(row.school)<.00001);
});

test('purchase-month liquidity incorporates expenses before purchase',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+2;
  const projection=x.modelYears(p.propertyPrice,true);
  const warning=x.fpAdviceData(p.propertyPrice,projection);
  assert.ok(warning.some(w=>w.title.includes('購入時')));
});

test('cash goal contributions end at target deadline',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.goalCashEnabled=1;p.goalCashYears=5;p.goalCashAmount=500;
  assert.equal(x.fpCashGoalForYear(now()+6),0);
});
