// FP: education savings insurance premium is a configurable outgoing, never
// an invented maturity payout; deficits are signed and explicitly red.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let js=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(js.includes(anchor));
js=js.replace(anchor,
 "  window.__schoolTest={state,ui,fpChildCounts,fpBaseMonthly,fpEducationInsuranceCard,fpSurplusStrip,fpYen,modelYears,fpMonthlyLedger};\n"+anchor);
const handlers={},storage={};let tick=1000,n=0;
class MockDate extends Date{static now(){return tick+=2000}}
const app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},addEventListener(k,fn){handlers[k]=fn},insertAdjacentHTML(){}};
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return 'edu-'+(++n)}},addEventListener(){}};
vm.runInNewContext(js,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'fake.invalid'},Date:MockDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const api=win.__schoolTest,p=api.state.plan;
const click=(act,value='')=>handlers.click({target:{closest(){return{dataset:{act,value}}}},preventDefault(){}});
const change=(dataset,value)=>handlers.change({target:{dataset,value}});
Object.assign(p,{
 children:2,firstChildYear:2028,birthInterval:3,childEducationInsuranceMonthly:.75,
 weddingCost:0,honeymoonCost:0,events:[],expenses:[],simulateUntil:2045,
 husbandMonthly:35,wifeMonthly:25,nisaMonthly:3});
const getEdu=y=>api.fpBaseMonthly(y).find(x=>x.key==='childEducationInsuranceMonthly').value;
assert.equal(getEdu(2026),0);
assert.equal(getEdu(2028),.75);
assert.equal(getEdu(2031),1.5);
assert.equal(getEdu(2046),0,'the two child cohorts reach 18 and leave the premium calculation');
const cardBefore=api.fpEducationInsuranceCard(2028);
assert.match(cardBefore,/学資保険/);
assert.match(cardBefore,/1人あたり/);
assert.match(cardBefore,/value="7500"/);
assert.match(cardBefore,/2028年の払込：1人分/);
assert.match(cardBefore,/7,500円 \/ 月/);
assert.match(cardBefore,/予定2人の合計：15,000円 \/ 月/);
assert.match(cardBefore,/1人 1,620,000円/,'18-year nominal paid-in premium, not a payout');
assert.match(cardBefore,/満期受取金は含めません/);
const cardNow=api.fpEducationInsuranceCard(2026);
assert.match(cardNow,/2026年の払込：0人分/);
assert.match(cardNow,/出生予定年以降に支出計上/);
const before=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2031);
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/data-fp-edu-insurance="true"/);
assert.match(app.innerHTML,/予定2人の合計/);
change({fpEduInsurance:'true'},'12000');
assert.equal(p.childEducationInsuranceMonthly,1.2,'yen are converted to legacy 10k yen units once');
assert.match(app.innerHTML,/value="12000"/);
assert.match(app.innerHTML,/予定2人の合計：24,000円 \/ 月/);
const stored=JSON.parse(storage['hoppy-phase1-v1']);
assert.equal(stored.plan.childEducationInsuranceMonthly,1.2,'premium is saved offline');
const after=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2031);
assert.ok(Math.abs(after.expenses-before.expenses-(1.2-.75)*2*12)<1e-8,
 'two insured children increase yearly expense by actual added premiums');
assert.ok(Math.abs(after.netCash-before.netCash+(1.2-.75)*2*12)<1e-8,
 'premium changes monthly cashflow, not investment assets');
const cardUpdated=api.fpEducationInsuranceCard(2031);
assert.match(cardUpdated,/24,000円 \/ 月/);
assert.match(cardUpdated,/1人 2,592,000円/);
const positive=api.fpSurplusStrip(50,10,'2026年');
const negative=api.fpSurplusStrip(50,-5,'2026年');
assert.match(positive,/fp-surplus-strip positive/);
assert.match(positive,/黒字/);
assert.match(positive,/\+100,000円/);
assert.match(negative,/fp-surplus-strip negative/);
assert.match(negative,/赤字/);
assert.match(negative,/-50,000円/);
p.husbandMonthly=1;p.wifeMonthly=0;p.husbandBonus=0;p.wifeBonus=0;
p.childEducationInsuranceMonthly=0;
click('fp-result-tab','1');
assert.match(app.innerHTML,/fp-month-surplus negative/,'monthly net shortfall is visually red');
assert.match(app.innerHTML,/赤字/);
assert.match(app.innerHTML,/fp-balance-chip/);
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-focus \.fp-month-surplus\.negative:has\(strong\.negative\)/);
assert.match(css,/\.fp-amount-negative/);
assert.match(css,/\.fp-education-card\s*\{/);
assert.match(css,/\.fp-report-screen>\.sim-intro,/);
assert.match(css,/\.fp-report-screen>\.fp-result-nav,/);
console.log('HOPPY FP red deficits, signed amounts and saved education insurance premiums: PASS');
