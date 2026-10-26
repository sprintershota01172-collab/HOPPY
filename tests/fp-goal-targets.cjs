// FP goal-based monthly contributions: NISA (compound) and each child's education target.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(source.includes(anchor));
source=source.replace(anchor,
  "  window.__goalTest={state,ui,fpTargetMonthly,fpEffectiveNisaMonthly,fpEffectiveOtherInvestMonthly,fpEducationGoal,fpEducationPremiumForYear,fpWizardPages,fpEducationInsuranceCard,modelYears};\n"+anchor);
const handlers={},storage={};let sequence=0;
const node={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
  contains(){return true},addEventListener(type,handler){handlers[type]=handler},insertAdjacentHTML(){}};
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++sequence)}},addEventListener(){}};
vm.runInNewContext(source,{document:{getElementById(){return node}},window:win,
  localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
  navigator:{},location:{protocol:'http:',hostname:'goal-test.invalid'},Date,
  crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
  Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const a=win.__goalTest,p=a.state.plan,now=new Date().getFullYear();
const near=(actual,want,label)=>assert.ok(Math.abs(actual-want)<=.0001,label+': '+actual+' vs '+want);
near(a.fpTargetMonthly(500,0,216,0),2.3149,'500万円 in 18 years, yen rounded up');
near(a.fpTargetMonthly(300,0,216,0),1.3889,'300万円 in 18 years');
near(a.fpTargetMonthly(1000,0,240,3),3.0595,'1000万円 at 3% in 20 years');
assert.ok(a.fpTargetMonthly(1000,100,240,3)<3.0595,'existing savings reduce required monthly');
assert.ok(a.fpTargetMonthly(1000,0,240,-5)>a.fpTargetMonthly(1000,0,240,0),'negative returns require more savings');
assert.equal(a.fpTargetMonthly(0,0,240,3),0);
assert.equal(a.fpTargetMonthly(10,0,0,0),Infinity,'expired target is explicitly infeasible');
Object.assign(p,{children:2,firstChildYear:now+2,birthInterval:3,
  childEducationInsuranceMonthly:.5,
  goalEduEnabled1:1,goalEduAmount1:500,goalEduAge1:18,
  goalEduEnabled2:1,goalEduAmount2:300,goalEduAge2:18,
  goalNisaEnabled:1,goalNisaAmount:1000,goalNisaYears:20,
  goalOtherEnabled:1,goalOtherAmount:300,goalOtherYears:10,
  returnAnnual:3,nisaBalance:0,investBalance:0});
near(a.fpEffectiveNisaMonthly(p),3.0595,'NISA goal overrides manually entered deposit');
assert.equal(a.fpEducationPremiumForYear(now,p),0,'no education insurance costs before birth');
near(a.fpEducationPremiumForYear(now+2,p),2.3149,'first child birth year');
near(a.fpEducationPremiumForYear(now+5,p),3.7038,'two separate child targets combined');
near(a.fpEducationPremiumForYear(now+20,p),1.3889,'first child target completed');
assert.equal(a.fpEducationPremiumForYear(now+23,p),0,'both child targets completed');
assert.equal(a.fpWizardPages(3).length,3,'education has separate goal screen for each child');
assert.equal(a.fpWizardPages(5).length,4,'investment goals have dedicated pages');
assert.match(a.fpEducationInsuranceCard(now+5),/500万円/);
assert.match(a.fpEducationInsuranceCard(now+5),/300万円/);
assert.match(a.fpEducationInsuranceCard(now+5),/目標編集/);
const r=.03,monthly=Math.pow(1+r,1/12)-1,n=240,pmt=a.fpEffectiveNisaMonthly(p);
const future=pmt*((Math.pow(1+monthly,n)-1)/monthly);
assert.ok(future>=1000&&future<1000.1,'monthly rounded amount reaches target');
p.simulateUntil=now+25;
const points=a.modelYears(p.propertyPrice,true).points;
const finalGoalYear=points.find(x=>x.year===now+19),yearAfter=points.find(x=>x.year===now+20);
assert.ok(finalGoalYear.nisa>=1000&&finalGoalYear.nisa<1000.1,'monthly deposits reach 20-year NISA target');
assert.equal(yearAfter.investing,0,'NISA and other investment transfers stop after each target horizon');
assert.ok(yearAfter.nisa>finalGoalYear.nisa,'existing NISA holdings can still grow after deposits stop');
p.goalNisaEnabled=0;p.nisaMonthly=3;
assert.equal(a.fpEffectiveNisaMonthly(p),3,'legacy manual amount remains untouched');
p.goalEduEnabled1=0;p.goalEduEnabled2=0;
near(a.fpEducationPremiumForYear(now+5,p),1,'legacy premium is per child');
console.log('HOPPY target-based NISA and separate child education savings: PASS');
