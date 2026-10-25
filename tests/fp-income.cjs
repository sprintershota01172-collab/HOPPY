// Annual and monthly FP income calculations must reconcile exactly and stay visible without scrolling.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let src=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  if('serviceWorker'";
assert.ok(src.includes(anchor));
src=src.replace(anchor,"  window.__incomeTest={getState:()=>state,fpMonthlyIncome,fpYearlyIncome,modelYears};\n"+anchor);
const storage={},handlers={};let clock=1e4,seq=0;
class FakeDate extends Date{static now(){return clock+=1000;}}
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},contains(){return true},
 addEventListener(k,fn){handlers[k]=fn},insertAdjacentHTML(){}};
const win={matchMedia(){return {matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(src,{
 document:{getElementById(){return app}},window:win,localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'test.invalid'},Date:FakeDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const click=(act,value='')=>handlers.click({target:{closest(){return {dataset:{act,value}}}},preventDefault(){}});
const changeYear=year=>handlers.change({target:{dataset:{fpYear:''},value:String(year)}});
const f=win.__incomeTest,p=f.getState().plan;
p.children=0;p.husbandMonthly=26;p.wifeMonthly=25;
p.husbandBonus=120;p.wifeBonus=20;p.husbandBonusMonth1=6;p.husbandBonusMonth2=12;
p.wifeBonusMonth1=6;p.wifeBonusMonth2=12;p.events=[{id:'extra',year:2026,month:7,type:'income',amount:12,name:'臨時収入',kind:'custom'}];
const annual=f.fpYearlyIncome(2026);
assert.equal(annual.fields.husbandPay,312);
assert.equal(annual.fields.wifePay,300);
assert.equal(annual.fields.husbandBonus,120);
assert.equal(annual.fields.wifeBonus,20);
assert.equal(annual.fields.eventIncome,12);
assert.equal(annual.total,764);
assert.equal(annual.months[0].total,51);
assert.equal(annual.months[5].total,121);
assert.equal(annual.months[6].total,63);
assert.equal(annual.months[11].total,121);
assert.ok(Math.abs(annual.months.reduce((sum,m)=>sum+m.total,0)-annual.total)<1e-9);
const model=f.modelYears(p.propertyPrice,true),yearPoint=model.points.find(x=>x.year===2026);
assert.equal(yearPoint.incomes,annual.total,'cash flow and income report agree');
p.husbandBonusMonth2=0;
assert.equal(f.fpYearlyIncome(2026).total,764);
assert.equal(f.fpMonthlyIncome(2026,6).fields.husbandBonus,120);
assert.equal(f.fpMonthlyIncome(2026,12).fields.husbandBonus,0);
p.events[0].month=0;
assert.equal(f.fpMonthlyIncome(2026,7).fields.eventIncome,1);
assert.equal(f.fpYearlyIncome(2026).fields.eventIncome,12);
p.children=2;p.firstChildYear=2028;p.birthInterval=3;p.childBenefitMonthly=.5;
const birthIncome=f.fpYearlyIncome(2028);
assert.equal(birthIncome.fields.wifePay,120);
assert.equal(birthIncome.fields.wifeBonus,0);
assert.equal(birthIncome.fields.childBenefits,6);
const secondKid=f.fpYearlyIncome(2031);
assert.equal(secondKid.fields.childBenefits,12);
for(const yr of [2026,2028,2031,2043]){
 const group=f.fpYearlyIncome(yr),modelPoint=f.modelYears(p.propertyPrice,true).points.find(x=>x.year===yr);
 assert.ok(Math.abs(group.total-modelPoint.incomes)<1e-8,'yearly income ledger reconciles '+yr);
 assert.ok(Math.abs(group.months.reduce((a,b)=>a+b.total,0)-group.total)<1e-8,'monthly sum reconciles '+yr);
}
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
click('fp-result-tab','2');
assert.match(app.innerHTML,/収入の内訳/);
assert.match(app.innerHTML,/年単位/);
assert.match(app.innerHTML,/夫の給与/);
assert.match(app.innerHTML,/臨時収入・その他/);
click('fp-income-period','month');
assert.match(app.innerHTML,/月単位/);
assert.match(app.innerHTML,/fp-income-timeline/);
click('fp-income-month','7');
assert.match(app.innerHTML,/202\d年 7月の手取り収入/);
changeYear(2028);
assert.match(app.innerHTML,/2028年 7月の手取り収入/);
assert.match(app.innerHTML,/妻の給与/);
click('fp-income-period','year');
assert.match(app.innerHTML,/2028年 年間の手取り収入/);
assert.doesNotMatch(app.innerHTML,/fp-income-timeline/);
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-income-report\{[^}]*overflow:hidden!important/);
assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
console.log('HOPPY yearly/monthly income breakdown, bonuses, benefits, events and no-scroll UI: PASS');