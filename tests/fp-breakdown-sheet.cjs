// HOPPY FP inline allocation: no screen change, current year, editable details.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let src=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(src.includes(anchor));
src=src.replace(anchor,
  "  window.__breakdownTest={getState:()=>state,ui,modelYears,fpYearPoint,fpMonthlyLedger,fpIncomeAllocation,fpMonthlyAllocation,fpPieBreakdownRows};\n"+anchor);
const saved={},listeners={};
let sequence=0,tick=1000;
class FakeDate extends Date{static now(){return tick+=2000;}}
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
  contains(){return true},addEventListener(k,f){listeners[k]=f},insertAdjacentHTML(){}};
const win={matchMedia(){return {matches:false}},crypto:{randomUUID(){return String(++sequence)}},addEventListener(){}};
vm.runInNewContext(src,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return saved[k]||null},setItem(k,v){saved[k]=v}},navigator:{},
 location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,crypto:win.crypto,confirm(){return true},
 setTimeout(){return 0},clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const api=win.__breakdownTest,p=api.getState().plan;
const click=(act,value='',period='')=>listeners.click({target:{closest(){return {dataset:{act,value,period}}}},preventDefault(){}});
const selectYear=y=>listeners.change({target:{dataset:{fpYear:''},value:String(y)}});
const change=(field,value)=>listeners.change({target:{dataset:{fpBreakdownField:field},value:String(value)}});
Object.assign(p,{children:0,propertyPrice:4500,purchaseYear:2028,purchaseMonth:9,
 foodMonthly:3.3,livingMonthly:4.4,rentMonthly:8,managementMonthly:.5,parkingMonthly:.5,
 housingOngoing:2,nisaMonthly:3,otherInvestMonthly:2,downPayment:0,
 waterBiMonthly:.6,electricityMonthly:1.2,annualTax:6,
 carTaxAnnual:4,travelAnnual:6,weddingCost:0,honeymoonCost:0,simulateUntil:2038,
 events:[{id:'eve',year:2028,month:10,type:'expense',amount:80,name:'引越祝い',kind:'custom'}],
 expenses:[{id:'extra',name:'習い事',amount:1,cycle:'month',start:0,end:0}]});

let reconciled=0;
for(const year of [2026,2028,2030]){
 const point=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===year);
 const annual=api.fpIncomeAllocation(point);
 for(const item of annual.items){
  const sum=api.fpPieBreakdownRows(point,null,item.id).reduce((a,x)=>a+x.amount,0);
  assert.ok(Math.abs(sum-item.amount)<1e-7,year+' annual '+item.id+' '+sum+' != '+item.amount);
  reconciled++;
 }
 for(const month of api.fpMonthlyLedger(point).months){
  for(const item of api.fpMonthlyAllocation(month).items){
   const sum=api.fpPieBreakdownRows(point,month,item.id).reduce((a,x)=>a+x.amount,0);
   assert.ok(Math.abs(sum-item.amount)<1e-7,year+' '+month.month+' '+item.id+' '+sum+' != '+item.amount);
   reconciled++;
  }
 }
}
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/data-fp-cash-month/,'FP opens directly to monthly cashflow');
assert.equal(api.ui.fpYear,new Date().getFullYear(),'selected year starts with the current year');
assert.match(app.innerHTML,/data-fp-inline-breakdown/,'details are within the monthly report');
assert.match(app.innerHTML,/fp-month-pie/);
assert.doesNotMatch(app.innerHTML,/data-fp-breakdown-sheet/,'no full-screen sheet');
assert.ok(app.innerHTML.indexOf('fp-month-pie')<app.innerHTML.indexOf('data-fp-inline-breakdown'),
  'selected detail is placed below the monthly pie');

click('fp-breakdown-select','housing','monthly');
assert.match(app.innerHTML,/家賃/,'rent displayed before buying');
click('fp-row-edit','field|rentMonthly','monthly');
assert.match(app.innerHTML,/data-fp-breakdown-field="rentMonthly"/);
selectYear(2028);click('fp-cash-month','9');
click('fp-breakdown-select','housing','monthly');
assert.match(app.innerHTML,/住宅ローン返済/,'mortgage displayed from purchase month');
assert.match(app.innerHTML,/住宅維持費/);
click('fp-breakdown-select','investing','monthly');
click('fp-row-edit','field|nisaMonthly','monthly');
assert.match(app.innerHTML,/data-fp-breakdown-field="nisaMonthly"/);
change('nisaMonthly',45000);
assert.equal(p.nisaMonthly,4.5,'inline editing saved original field');
assert.match(app.innerHTML,/data-fp-inline-breakdown/,'editing does not navigate');
assert.match(app.innerHTML,/NISA積立/);
assert.equal(api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2028).investing,
  12*(4.5+p.otherInvestMonthly),'forecast recalculated');

click('fp-result-tab','3');click('fp-chart-page','3');
assert.match(app.innerHTML,/fp-pie-chart/);
assert.match(app.innerHTML,/data-fp-inline-breakdown/,'annual details remain under pie');
click('fp-breakdown-select','education','annual');
assert.match(app.innerHTML,/頭金・住宅購入諸費用/);
assert.ok(app.innerHTML.indexOf('fp-pie-figure')<app.innerHTML.indexOf('data-fp-inline-breakdown'));

const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-month-report:has\(\.fp-breakdown-panel\)/);
assert.match(css,/\.fp-focus \.fp-breakdown-list\s*\{[^}]*display:grid!important/);
assert.match(css,/\.fp-inline-edit input\s*\{[^}]*font-size:16px!important/);
console.log('HOPPY inline monthly/annual breakdown: '+reconciled+' reconciled slices and editable inputs PASS');
