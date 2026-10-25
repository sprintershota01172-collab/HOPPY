// HOPPY FP post-purchase forecast: explainable cash-flow, amortization, interest shocks and UI navigation.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(source.includes(anchor),'test hook anchor exists');
source=source.replace(anchor,
  "  window.__reportTest={getPlan:()=>state.plan,modelYears,fpAmortization,fpExpenseDetails,fpAdviceData};\n"+anchor);
const storage={},listeners={},app={
  innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
  contains(){return true},addEventListener(k,fn){listeners[k]=fn},insertAdjacentHTML(){}
};
let seq=0,time=0;
class FakeDate extends Date{static now(){return time+=2000;}}
const win={matchMedia(){return {matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
const ctx={
  document:{getElementById(){return app}},window:win,
  localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
  navigator:{},location:{protocol:'http:',hostname:'test.invalid'},
  Date:FakeDate,crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise
};
vm.runInNewContext(source,ctx,{filename:'app.js'});
const click=(action,value='')=>listeners.click({
 target:{closest(){return {dataset:{act:action,value}}}},preventDefault(){}
});
const f=win.__reportTest,p=f.getPlan();
p.purchaseYear=2027;p.propertyPrice=4500;p.downPayment=0;p.loanYears=10;p.interest=1.5;
p.housingOngoing=2.5;p.children=0;p.weddingYear=2026;p.weddingCost=0;p.honeymoonCost=0;
p.expenses=[];p.cashSavings=1000;p.support=0;p.livingMonthly=12;
const loan=f.fpAmortization(4500);
assert.equal(loan.years,10);
assert.equal(loan.points.length,11);
assert.equal(loan.points[0].balance,4500);
assert.ok(Math.abs(loan.points.at(-1).balance)<1e-6,'loan paid off on schedule');
const repaid=loan.points.slice(1).reduce((sum,x)=>sum+x.principalPaid,0);
assert.ok(Math.abs(repaid-4500)<1e-6,'principal equals original debt');
const interest=loan.points.slice(1).reduce((sum,x)=>sum+x.interest,0);
assert.ok(interest>0,'interest is calculated separately');
const scenarios=[0,.5,1,2].map(shift=>f.fpAmortization(4500,shift).monthly);
assert.ok(scenarios.every((v,i)=>i===0||v>scenarios[i-1]),'rising interest raises monthly payment');
const buy=f.modelYears(4500,true),rent=f.modelYears(4500,false);
const during=buy.points.find(x=>x.year===2028);
const after=buy.points.find(x=>x.year===2037);
assert.ok(during.housing>p.housingOngoing,'monthly mortgage included before payoff');
assert.ok(Math.abs(after.housing-p.housingOngoing)<1e-8,'mortgage stops after payoff');
assert.ok(Math.abs(after.loanBalance)<1e-8,'balance is zero after term');
assert.ok(rent.points.find(x=>x.year===2037).housing>0,'rent continues for rental comparison');
for(const selected of [buy.points[0],buy.points.find(x=>x.year===2027),after]){
 const expense=f.fpExpenseDetails(selected,true).reduce((sum,x)=>sum+x.amount,0);
 assert.ok(Math.abs(expense-selected.expenses)<1e-7,'spending line items tie to annual total');
}
const advice=f.fpAdviceData(4500,buy);
assert.ok(advice.some(x=>x.title.includes('金利上昇時')));
assert.ok(advice.some(x=>x.detail.includes('＋0.5%')&&x.detail.includes('＋2%')));
click('tab','sim');
for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/data-fp-cash-month/);
click('fp-result-tab','0');
assert.match(app.innerHTML,/fp-r-summary/);
assert.match(app.innerHTML,/fp-r-summary/);
click('fp-result-tab','3');
assert.match(app.innerHTML,/購入後の現金残高/);
assert.match(app.innerHTML,/fp-r-chart/);
click('fp-chart-page','1');
assert.match(app.innerHTML,/年間の収入と支出/);
click('fp-chart-page','2');
assert.match(app.innerHTML,/ローン残債・元金と利息/);
click('fp-result-tab','5');
assert.match(app.innerHTML,/期首現金残高/);
click('fp-calc-page','1');
assert.match(app.innerHTML,/元利均等/);
click('fp-calc-page','2');
assert.match(app.innerHTML,/年間の支出明細/);
click('fp-calc-page','3');
assert.match(app.innerHTML,/金融庁/);
assert.match(app.innerHTML,/総返済負担率は判定しません/);
click('fp-result-tab','6');
assert.match(app.innerHTML,/家計診断・改善ポイント/);
click('fp-advice-page','1');
assert.match(app.innerHTML,/＋0.5%/);
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-r-chart\{/);
assert.match(css,/\.fp-report-screen\{[^}]*overflow:hidden!important/);
console.log('HOPPY advanced FP charts, calculation breakdown, mortgage amortization and advice: PASS');