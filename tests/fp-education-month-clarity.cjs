// Clear age-specific school expense and signed monthly cashflow, no fabricated university bill.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let src=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(src.includes(anchor));
src=src.replace(anchor,
"  window.__clearEducationTest={state,ui,fpSchoolBreakdown,fpPieBreakdownRows,fpMonthlyReport,fpMonthlyLedger,modelYears};\n"+anchor);
const listeners={},storage={};let seq=0;
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},insertAdjacentHTML(){},addEventListener(key,fn){listeners[key]=fn}};
const win={matchMedia(){return {matches:false}},
 crypto:{randomUUID(){return 'school-'+(++seq)}},addEventListener(){}};
vm.runInNewContext(src,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'test.invalid'},Date,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const a=win.__clearEducationTest,p=a.state.plan;
Object.assign(p,{children:2,firstChildYear:2028,birthInterval:3,highSchool:'public',
 propertyPrice:4500,purchaseYear:2028,purchaseMonth:1,interest:1.5,loanYears:50,
 husbandMonthly:26,wifeReduced:12.5,husbandBonus:120,weddingCost:0,honeymoonCost:0,
 livingMonthly:20,nisaMonthly:3,childEducationInsuranceMonthly:1.5,simulateUntil:2045});
const ages=a.fpSchoolBreakdown(2036);
assert.equal(ages.length,2);
assert.equal(ages[0].age,8);assert.equal(ages[0].stage,'小学校');assert.equal(ages[0].annual,34);
assert.equal(ages[1].age,5);assert.equal(ages[1].stage,'未就学');assert.equal(ages[1].annual,0);
const point=a.modelYears(p.propertyPrice,true).points.find(x=>x.year===2036);
assert.ok(point,'2036 model point exists');
assert.equal(point.school,34,'2036 annual school cost is only first child 34万円');
const ledger=a.fpMonthlyLedger(point),january=ledger.months[0];
const rows=a.fpPieBreakdownRows(point,january,'living');
const school=rows.filter(x=>x.label.includes('小学校'));
assert.equal(school.length,1);
assert.equal(school[0].label,'第1子 小学校（8歳）');
assert.ok(Math.abs(school[0].amount-34/12)<1e-10,'monthly amount 28,333yen');
assert.ok(!rows.some(x=>x.label.includes('大学の費用')),'no ambiguous school/university label');
a.ui.fpYear=2036;a.ui.fpCashMonth=1;
const html=a.fpMonthlyReport(a.modelYears(p.propertyPrice,true));
assert.match(html,/今月の現金収支/);
assert.match(html,/積立前/);
assert.match(html,/第1子 8歳 小学校/);
assert.match(html,/第2子 5歳 未就学・学校費0円/);
assert.match(html,/生活費・子ども費/);
assert.match(html,/ローン・住居費/);
assert.match(html,/投資積立/);
assert.doesNotMatch(html,/学校・大学の費用（月割）/);
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-child-school-context\{/);
assert.match(css,/\.fp-focus \.fp-breakdown-list\.three-columns>/);
assert.match(css,/overflow-y:auto!important/);
console.log('HOPPY compact monthly display, 2036 child ages and school costs: PASS');
