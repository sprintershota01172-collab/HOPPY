// Regression: FP pie slice details must never live inside the clipped chart pane.
// The detail sheet is a direct app-shell child with its own scrolling list.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let source=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  if('serviceWorker'";
assert.ok(source.includes(anchor));
source=source.replace(anchor,"  window.__fpBreakdownTest={state,ui,modelYears,fpYearPoint,fpMonthlyLedger,fpIncomeAllocation,fpMonthlyAllocation,fpPieBreakdownRows,fpMonthlyPie,fpPieChart};\n"+anchor);

const store={},listeners={};
let now=1000,sequence=0;
class FakeDate extends Date{static now(){return now+=1600;}}
const app={
  innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
  contains(){return true},addEventListener(name,fn){listeners[name]=fn},
  insertAdjacentHTML(){}
};
const win={
  matchMedia(){return{matches:false}},
  crypto:{randomUUID(){return 'test-'+(++sequence)}},
  addEventListener(){}
};
vm.runInNewContext(source,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__fpBreakdownTest,p=api.state.plan;
const click=(act,value='',period='')=>listeners.click({
  target:{closest(){return{dataset:{act,value,period}}}},
  preventDefault(){}
});
const change=dataset=>listeners.change({target:{dataset,value:'4.5'}});

Object.assign(p,{
  children:0,propertyPrice:4500,purchaseYear:2028,simulateUntil:2035,
  foodMonthly:3,livingMonthly:8,carMonthly:1,waterBiMonthly:.7,
  electricityMonthly:1.2,annualTax:6,carTaxAnnual:4,travelAnnual:8,
  nisaMonthly:3,otherInvestMonthly:1,weddingCost:0,honeymoonCost:0,
  expenses:[{id:'extra',name:'習い事',amount:2,cycle:'month',start:0,end:0}],
  events:[{id:'wedding',name:'結婚式',amount:250,year:2028,month:2,type:'expense',kind:'wedding'}]
});

// All plotted slices reconcile with the contents of the sheet.
let reconciled=0;
for(const year of [2026,2028,2030]){
  const point=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===year);
  const annual=api.fpIncomeAllocation(point);
  for(const slice of annual.items){
    const sum=api.fpPieBreakdownRows(point,null,slice.id).reduce((a,b)=>a+b.amount,0);
    assert.ok(Math.abs(sum-slice.amount)<1e-7,year+' annual '+slice.id);
    reconciled++;
  }
  for(const record of api.fpMonthlyLedger(point).months){
    for(const slice of api.fpMonthlyAllocation(record).items){
      const sum=api.fpPieBreakdownRows(point,record,slice.id).reduce((a,b)=>a+b.amount,0);
      assert.ok(Math.abs(sum-slice.amount)<1e-7,year+'/'+record.month+' '+slice.id);
      reconciled++;
    }
  }
}

click('tab','sim');
for(let i=0;i<7;i++)click('sim-next');
click('fp-result-tab','1');
assert.match(app.innerHTML,/fp-month-pie/);
assert.doesNotMatch(app.innerHTML,/fp-breakdown-panel/,'monthly pie must not force an inline detail panel');
click('fp-breakdown-select','living','monthly');
assert.match(app.innerHTML,/data-fp-breakdown-sheet/);
assert.match(app.innerHTML,/fp-breakdown-list/);
assert.match(app.innerHTML,/食費/);
assert.ok(app.innerHTML.indexOf('data-fp-breakdown-sheet')>app.innerHTML.indexOf('</nav>'),
  'sheet must be a child of #app after the bottom navigation');
for(const key of ['housing','education','investing','remaining']){
  click('fp-breakdown-select',key,'monthly');
  assert.match(app.innerHTML,new RegExp('class="fp-breakdown-sheet-tab active"[^>]*data-value="'+key+'"|data-value="'+key+'" class="fp-breakdown-sheet-tab active"'),
    'category tab '+key);
}
click('fp-breakdown-select','investing','monthly');
assert.match(app.innerHTML,/data-fp-breakdown-field="nisaMonthly"/);
const prior=p.nisaMonthly;
change({fpBreakdownField:'nisaMonthly'});
assert.equal(p.nisaMonthly,4.5,'editing the amount updates source data');
assert.match(app.innerHTML,/data-fp-breakdown-sheet/,'editor retains sheet');
const after=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2028);
assert.equal(after.investing,12*(4.5+p.otherInvestMonthly),'forecast recalculates monthly contributions');
assert.notEqual(prior,p.nisaMonthly);

click('fp-breakdown-close');
assert.doesNotMatch(app.innerHTML,/data-fp-breakdown-sheet/,'close returns to chart');
click('fp-result-tab','3');
click('fp-chart-page','3');
assert.match(app.innerHTML,/fp-pie-figure/);
assert.doesNotMatch(app.innerHTML,/fp-breakdown-panel/,'annual pie must not force an inline detail panel');
click('fp-breakdown-select','education','annual');
assert.match(app.innerHTML,/data-fp-breakdown-sheet/);
assert.match(app.innerHTML,/年間の内訳|内訳/);
assert.match(app.innerHTML,/イベント/);
const yearOptions=app.innerHTML.match(/class="fp-breakdown-sheet-tab(?: active)?"/g)||[];
assert.equal(yearOptions.length,5,'all categories selectable without scrolling parent');
click('fp-breakdown-close');
assert.doesNotMatch(app.innerHTML,/data-fp-breakdown-sheet/);

const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.app-shell\s*>\s*\.fp-breakdown-sheet\s*\{[^}]*position:absolute!important/);
assert.match(css,/\.fp-breakdown-sheet\s+\.fp-breakdown-list\s*\{[^}]*overflow-y:auto!important/);
assert.match(css,/\.fp-breakdown-sheet\s+\.fp-breakdown-list\s*\{[^}]*touch-action:pan-y/);
assert.match(css,/env\(safe-area-inset-bottom/);
assert.match(css,/\.fp-breakdown-sheet\s+\.fp-breakdown-edit input\s*\{[^}]*font-size:16px/);
console.log('HOPPY full-screen FP breakdown sheet:',reconciled,'reconciled slices; navigation, editing, scroll CSS PASS');
