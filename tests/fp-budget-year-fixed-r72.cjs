'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const anchor='\n  save();render();\n  // The startup';
assert.equal(source.split(anchor).length,2,'App test bridge anchor changed');
const bridge='\n  globalThis.__yearTest={fpBudget,fpSelectedYearCashflow,fpMetaDashboard,fpLoanFocusCard,ui,state}; return;\n  // The startup';
const app={addEventListener(){},querySelector(){return null;},querySelectorAll(){return []}};
const context={
 document:{getElementById(){return app;},addEventListener(){},querySelectorAll(){return []}},
 window:{matchMedia(){return {matches:false};},addEventListener(){},crypto:{}},
 localStorage:{getItem(){return null;},setItem(){}},
 navigator:{},location:{protocol:'https:',hostname:'localhost'},confirm(){return false;},console
};
vm.runInNewContext(source.replace(anchor,bridge),context,{filename:'app.js',timeout:5000});
const x=context.__yearTest,now=new Date().getFullYear();
const plan=x.state.plan;
plan.propertyPrice=3700;plan.purchaseYear=now+2;plan.purchaseMonth=7;
plan.children=1;plan.firstChildYear=now+3;
plan.foodMonthly=3;plan.electricityMonthly=1;
const budgetText=html=>{const m=html.match(/class="fp-meta-budget"><strong>([^<]+)<\/strong>/);assert.ok(m,'budget hero missing');return m[1];};
const budget=x.fpBudget();
test('the purchase budget is invariant when the display year changes',()=>{
 const amounts=[];
 for(const year of [now,now+1,now+2,now+3,now+8,now+19]){
   x.ui.fpYear=year;
   amounts.push(budgetText(x.fpMetaDashboard()));
   assert.equal(x.fpBudget().amount,budget.amount);
   assert.equal(x.fpBudget().referenceYear,budget.referenceYear);
 }
 assert.equal(new Set(amounts).size,1,'viewing a different year changed the purchase price');
});
test('housing follows rent, transition month, loan and maintenance for the selected year',()=>{
 const before=x.fpSelectedYearCashflow(now+1,plan.propertyPrice,budget);
 const purchase=x.fpSelectedYearCashflow(now+2,plan.propertyPrice,budget);
 const after=x.fpSelectedYearCashflow(now+3,plan.propertyPrice,budget);
 assert.equal(before.period,'購入前・家賃');
 assert.equal(purchase.period,'購入年・家賃とローン');
 assert.equal(after.period,'購入後・ローンと維持費');
 assert.ok(before.housing>0);
 assert.ok(after.housing>before.housing,'fixture loan should be larger than rent');
 assert.ok(purchase.housing>before.housing && purchase.housing<after.housing);
 assert.notEqual(before.remaining,after.remaining);
});
test('loan card keeps origination capacity while showing selected-year risk separately',()=>{
 x.ui.fpYear=now;
 const initial=x.fpLoanFocusCard();
 x.ui.fpYear=now+3;
 const later=x.fpLoanFocusCard();
 assert.match(initial,/購入判断の基準：/);
 assert.match(initial,/年の収支（購入前・家賃）/);
 assert.match(later,/年の収支（購入後・ローンと維持費）/);
 assert.match(later,/表示年を変更しても住宅予算は変わりません/);
 assert.ok(initial.includes('借入可能額の目安'));
 assert.ok(later.includes('借入可能額の目安'));
});
