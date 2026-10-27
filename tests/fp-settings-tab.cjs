// FP settings are separate from monthly overview and keep financial values intact.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const anchor='  save();render();\n  // The startup wordmark';
assert.ok(source.includes(anchor));
const script=source.replace(anchor,'  window.__settingsTest={state,ui,modelYears,fpMonthlyLedger,fpMonthlySettingsScreen};\n'+anchor);
const storage={},handlers={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},addEventListener(name,fn){handlers[name]=fn},insertAdjacentHTML(){}};
let clock=5000,seq=0;
class DateStub extends Date{static now(){return clock+=2000;}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return 'settings-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(script,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'test.invalid'},Date:DateStub,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const a=win.__settingsTest,click=(act,value='')=>handlers.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
const change=(dataset,value)=>handlers.change({target:{dataset,value}});
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/fp-month-report/);
assert.match(app.innerHTML,/fp-month-savings-trend/);
assert.match(app.innerHTML,/fp-month-pie/);
assert.doesNotMatch(app.innerHTML,/data-fp-quick-key=/,'no free-spending or goal input in monthly view');
assert.doesNotMatch(app.innerHTML,/data-fp-edu-insurance=/,'no insurance input in monthly view');
assert.match(app.innerHTML,/data-value="7"/,'FP Settings tab visible');
click('fp-result-tab','7');
assert.match(app.innerHTML,/fp-settings-report/);
assert.match(app.innerHTML,/毎月の家計設定/);
assert.match(app.innerHTML,/自由費/);
assert.match(app.innerHTML,/学資保険/);
assert.match(app.innerHTML,/現金貯金目標/);
assert.match(app.innerHTML,/data-fp-quick-key="freeSpendingMonthly"/);
assert.match(app.innerHTML,/data-fp-quick-key="otherSavingsMonthly"/);
const original=Number(a.state.plan.freeSpendingMonthly)||0;
const model0=a.modelYears(a.state.plan.propertyPrice,true);
const year=2028, before=model0.points.find(x=>x.year===year);
change({fpQuickKey:'freeSpendingMonthly'},'45000');
assert.equal(a.state.plan.freeSpendingMonthly,4.5,'free spending yen converts once');
assert.match(app.innerHTML,/value="45000"/);
const model1=a.modelYears(a.state.plan.propertyPrice,true);
const next=model1.points.find(x=>x.year===year);
assert.ok(Math.abs(next.expenses-before.expenses-(4.5-original)*12)<1e-6,'free spending changes annual spending');
const expense=next.expenses;
change({fpQuickKey:'otherSavingsMonthly'},'25000');
assert.equal(a.state.plan.otherSavingsMonthly,2.5);
assert.equal(a.modelYears(a.state.plan.propertyPrice,true).points.find(x=>x.year===year).expenses,expense,'cash target is not expense');
assert.match(app.innerHTML,/value="25000"/);
if(app.innerHTML.includes('data-fp-edu-insurance')){
 change({fpEduInsurance:'true'},'12500');
 assert.equal(a.state.plan.childEducationInsuranceMonthly,1.25);
 assert.match(app.innerHTML,/value="12500"/);
}
assert.equal(JSON.parse(storage['hoppy-phase1-v1']).plan.otherSavingsMonthly,2.5);
click('fp-result-tab','1');
assert.match(app.innerHTML,/fp-month-report/);
assert.match(app.innerHTML,/fp-month-savings-trend/);
assert.doesNotMatch(app.innerHTML,/data-fp-quick-key=/);
console.log('HOPPY monthly settings tab, inputs, cash target and expense linkage: PASS');
