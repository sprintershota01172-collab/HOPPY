// HOPPY: actual purchase year/month controls rent, mortgage, costs and full-term loan schedule.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let src=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(src.includes(anchor));
src=src.replace(anchor,"  window.__purchaseTest={getPlan:()=>state.plan,modelYears,fpAmortization,fpMonthlyLedger,fpPieBreakdownRows,fpExpenseDetails};\n"+anchor);
const storage={},events={};let n=0,tick=1000;
class FakeDate extends Date{static now(){return tick+=2000;}}
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},
 addEventListener(name,handler){events[name]=handler},insertAdjacentHTML(){}};
const win={matchMedia(){return {matches:false}},crypto:{randomUUID(){return String(++n)}},addEventListener(){}};
vm.runInNewContext(src,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'example.invalid'},Date:FakeDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const api=win.__purchaseTest,p=api.getPlan();
Object.assign(p,{propertyPrice:4400,purchaseYear:2028,downPayment:0,
 rentMonthly:8,managementMonthly:.5,commonFeeMonthly:0,parkingMonthly:.5,
 housingOngoing:2,interest:1.5,loanYears:35,children:0,
 weddingCost:0,honeymoonCost:0,expenses:[],events:[],simulateUntil:2040});
const rentTotal=9,ongoing=2;
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,label+': '+a+' vs '+b);
let cases=0;
for(const purchaseMonth of [1,5,9,12]){
 p.purchaseMonth=purchaseMonth;
 const loan=api.fpAmortization(p.propertyPrice);
 assert.equal(loan.months[0].year,2028);
 assert.equal(loan.months[0].month,purchaseMonth);
 assert.equal(loan.months.length,420,'35 years × 12 monthly installments');
 close(loan.months.reduce((sum,x)=>sum+x.principalPaid,0),4400,'fully repaid');
 close(loan.points.reduce((sum,x)=>sum+x.principalPaid,0),4400,'annual amortization reconciles');
 const model=api.modelYears(p.propertyPrice,true);
 const point=model.points.find(x=>x.year===2028);
 const previous=model.points.find(x=>x.year===2027);
 const next=model.points.find(x=>x.year===2029);
 const rentBefore=purchaseMonth-1,monthsOwned=13-purchaseMonth;
 assert.equal(point.rentMonths,rentBefore);
 assert.equal(point.ownedMonths,monthsOwned);
 close(point.housingRent,rentBefore*rentTotal,'rental months');
 close(point.housingMaintenance,monthsOwned*ongoing,'owned months');
 close(point.housingLoan,monthsOwned*loan.monthly,'mortgage installments in purchase year');
 close(point.housing*12,point.housingRent+point.housingMaintenance+point.housingLoan,'annual housing');
 close(previous.housing,rentTotal,'prior calendar year rents');
 close(next.housing,ongoing+loan.monthly,'following year mortgage');
 const ledger=api.fpMonthlyLedger(point);
 for(const row of ledger.months){
  const isOwner=row.month>=purchaseMonth;
  close(row.housing,isOwner?ongoing+loan.monthly:rentTotal,
   'monthly housing '+purchaseMonth+'/'+row.month);
  close(row.purchase,row.month===purchaseMonth?4400*.07:0,'upfront cost '+row.month);
  const details=api.fpPieBreakdownRows(point,row,'housing');
  close(details.reduce((sum,x)=>sum+x.amount,0),row.housing,'housing pie detail '+row.month);
  assert.equal(details.some(x=>x.label==='家賃'),!isOwner,
   'switch rental line exactly in selected month');
  assert.equal(details.some(x=>x.label==='住宅ローン返済'),isOwner,
   'switch mortgage line exactly in selected month');
  cases++;
 }
 const annual=api.fpPieBreakdownRows(point,null,'housing');
 close(annual.reduce((sum,x)=>sum+x.amount,0),point.housing*12,'annual housing detail');
 close(api.fpExpenseDetails(point,true).reduce((sum,x)=>sum+x.amount,0),
   point.expenses,'annual spending breakdown');
 close(ledger.months.reduce((sum,x)=>sum+x.spending,0),point.expenses,'annual-monthly expense reconciliation');
 close(ledger.months.reduce((sum,x)=>sum+x.net,0),point.netCash,'cash reconciliation');
 close(ledger.ending,point.cash,'year-end cash reconciliation');
}
// Imported older plans have no purchaseMonth. Use January rather than shifting saved finances.
const snapshot=JSON.parse(storage['hoppy-phase1-v1']);
delete snapshot.plan.purchaseMonth;
storage['hoppy-phase1-v1']=JSON.stringify(snapshot);
const oldApp={...app,addEventListener(){}};
const win2={matchMedia(){return{matches:false}},crypto:win.crypto,addEventListener(){}};
vm.runInNewContext(src,{document:{getElementById(){return oldApp}},window:win2,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,
 crypto:win2.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
assert.equal(win2.__purchaseTest.getPlan().purchaseMonth,1,'legacy data defaults to January');
console.log('HOPPY purchase-month mortgage switch: '+cases+' monthly cases, 4 yearly reconciliations PASS');
