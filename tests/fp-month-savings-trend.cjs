// The monthly FP page shows the monthly net and month-end cash trajectory together.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let code=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(code.includes(anchor));
code=code.replace(anchor,
 "  window.__savingsTest={state,ui,fpMonthlyReport,fpMonthlySavingsTrend,fpMonthlyLedger,modelYears,fpYen};\n"+anchor);
const listeners={},storage={},app={
 innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},addEventListener(n,fn){listeners[n]=fn},insertAdjacentHTML(){}
};
let tick=1000,seq=0;
class Clock extends Date{static now(){return tick+=1500;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(code,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},
 Date:Clock,crypto:win.crypto,confirm(){return true},
 setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__savingsTest;
const click=(act,value='')=>listeners.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/fp-month-surplus/);
assert.match(app.innerHTML,/月末の貯金/);
assert.match(app.innerHTML,/fp-month-savings-trend/);
assert.match(app.innerHTML,/手取り比/);
const model=api.modelYears(api.state.plan.propertyPrice,true);
const year=model.points[0].year;
api.ui.fpYear=year;
const ledger=api.fpMonthlyLedger(model.points[0]);
for(const month of [1,4,9,12]){
 api.ui.fpCashMonth=month;
 const rendered=api.fpMonthlyReport(model);
 const current=ledger.months[month-1];
 assert.ok(rendered.includes(api.fpYen(current.net)),'monthly net appears '+month);
 assert.ok(rendered.includes(api.fpYen(current.endingCash)),'month-end cash appears '+month);
 assert.ok(rendered.includes(year+'年'+month+'月'),'selected month appears '+month);
 assert.match(rendered,/fp-month-savings-trend/);
 const chart=api.fpMonthlySavingsTrend(ledger,month);
 assert.ok(chart.includes(month===1?'cx="4.0"':month===12?'cx="146.0"':'<circle cx='),'active month highlighted '+month);
 assert.ok(chart.includes('12月'+api.fpYen(ledger.months[11].endingCash)),'chart includes December cash');
}
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-month-savings-trend/);
assert.match(css,/FP r38: Fix monthly donut to a constant diameter/);
console.log('HOPPY monthly surplus + 12-month savings trend and chosen month, chart size invariant: PASS');
