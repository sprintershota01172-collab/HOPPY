'use strict';
// Run: node --test tests/finance.test.cjs
// Offline, deterministic tests against the same functions used by the PWA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFinance(seed=null){
  const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const marker='\n  save();render();\n  // The startup';
  assert.equal(source.split(marker).length,2,'App test anchor changed');
  const bridge='\n  globalThis.__finance = {state,ui,defaultPlan,fpBudget,fpRating,fpMortgageCapacityCard,mortgageMonthly,modelYears,fpMonthlyLedger,fpEducationFundYears,fpSchoolBreakdown,fpCashGoalForYear,fpAdviceData,fpHouseholdCashSavings,fpSyncHouseholdCashSavings,fpLoanSummary,fpMonthlyReport,fpMonthlyAllocation,fpIncomeAllocation,fpPieBreakdownRows,fpPieBreakdownPanel,fpWizardPages}; return;\n  // The startup';
  const app={addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
  const ctx={
    document:{getElementById:()=>app,addEventListener(){},querySelectorAll(){return []}},
    window:{matchMedia:()=>({matches:false}),addEventListener(){},crypto:{}},
    localStorage:{getItem:()=>seed?JSON.stringify(seed):null,setItem(){}},
    navigator:{},location:{protocol:'https:',hostname:'localhost'},
    confirm:()=>false,console
  };
  vm.runInNewContext(source.replace(marker,bridge),ctx,{filename:'app.js',timeout:5000});
  return ctx.__finance;
}
const now=()=>new Date().getFullYear();

test('PMT amount and inverse principal use 10,000-yen units',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+2;
  const b=x.fpBudget();
  assert.ok(b.amount>0);
  assert.ok(Math.abs(x.mortgageMonthly(b.amount,0,p.interest,p.loanYears)-b.loanPayment)<.00001);
  assert.equal(x.mortgageMonthly(4200,0,0,35),4200/(35*12));
});

test('loan payment and borrowing capacity are not displayed as a positive surplus',()=>{
  const x=loadFinance();
  const html=x.fpMortgageCapacityCard();
  assert.match(html,/金利込み・積立維持の月返済目安/);
  assert.match(html,/借入参考額/);
  assert.doesNotMatch(html,/返済上限<\/span><strong>\+/);
});

test('temporary childbirth year pay does not become the lifetime payment baseline',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+2;
  assert.equal(x.fpBudget().referenceYear,p.purchaseYear+1);
  p.children=0;
  assert.equal(x.fpBudget().referenceYear,p.purchaseYear);
});

test('no income cannot create loan capacity',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.husbandMonthly=0;p.wifeMonthly=0;p.wifeReduced=0;
  assert.equal(x.fpBudget().amount,0);
});

test('rent is dropped on purchase, but ordinary living expenses remain',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+4;p.children=0;
  const before=x.fpBudget().amount;
  p.rentMonthly=99;
  assert.equal(x.fpBudget().amount,before,'Rent must not be counted after purchase');
  p.foodMonthly+=5;
  assert.ok(x.fpBudget().amount<before,'Food costs must reduce capacity');
});

test('missing essential inputs, and genuine catch-all overlaps, are flagged',()=>{
  const x=loadFinance(),p=x.state.plan;
  assert.ok(x.fpBudget().missingEssentialInputs.length>0);
  p.livingMonthly=20;p.foodMonthly=0;
  assert.equal(x.fpBudget().possibleLivingOverlap,false);
  p.foodMonthly=3;
  assert.equal(x.fpBudget().possibleLivingOverlap,true);
});

test('education age is actual child age, not calendar-year offset',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.firstChildYear=now()+2;p.children=1;
  const grade=x.fpSchoolBreakdown(now()+10)[0];
  assert.equal(grade.age,8);
  assert.equal(grade.stage,'小学校');
});

test('education target accumulates and then offsets tuition, without double withdrawal',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.children=1;p.firstChildYear=now()+2;p.purchaseYear=now()+2;
  p.simulateUntil=now()+24;
  p.goalEduEnabled1=1;p.goalEduAmount1=500;p.goalEduAge1=18;
  const targetYear=p.firstChildYear+18;
  const fund=x.fpEducationFundYears(p,targetYear);
  assert.ok(Math.abs(fund.get(targetYear-1).closing-500)<.03);
  assert.equal(fund.get(targetYear).covered,125);
  assert.ok(Math.abs(fund.get(targetYear).closing-375)<.03);
  const projection=x.modelYears(4400,true);
  const year=projection.points.find(z=>z.year===targetYear);
  assert.ok(year);
  assert.equal(year.fundedSchool,125);
  assert.ok(Math.abs(x.fpMonthlyLedger(year).ending-year.cash)<.000001);
  const b=x.fpBudget(),row=b.years.find(z=>z.year===targetYear);
  assert.ok(Math.abs(row.school)<.00001);
});

test('purchase-month liquidity incorporates expenses before purchase',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;p.firstChildYear=now()+2;
  const projection=x.modelYears(p.propertyPrice,true);
  const warning=x.fpAdviceData(p.propertyPrice,projection);
  assert.ok(warning.some(w=>w.title.includes('購入時')));
});

test('cash goal contributions end at target deadline',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.goalCashEnabled=1;p.goalCashYears=5;p.goalCashAmount=500;
  assert.equal(x.fpCashGoalForYear(now()+6),0);
});


test('legacy household savings survive migration and are editable as two spouse rows',()=>{
  const saved={version:2,properties:[],criteria:[],plan:{cashSavings:287.5,husbandMonthly:26,wifeMonthly:25}};
  const x=loadFinance(saved),p=x.state.plan;
  assert.equal(p.husbandCashSavings,287.5);
  assert.equal(p.wifeCashSavings,0);
  assert.equal(p.cashSavings,287.5);
  assert.equal(p.legacySavingsNotice,1);
  p.husbandCashSavings=190.141;p.wifeCashSavings=100;
  x.fpSyncHouseholdCashSavings(p);
  assert.ok(Math.abs(p.cashSavings-290.141)<1e-8);
  assert.equal(p.legacySavingsNotice,0);
  const html=x.fpWizardPages(5)[0].html;
  assert.match(html,/夫の貯金残高/);
  assert.match(html,/妻の貯金残高/);
  assert.match(html,/夫婦合計/);
});

test('monthly final remainder deducts spending, investments, cash savings and emergency reserve exactly once',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.purchaseYear=now()+2;
  p.otherSavingsMonthly=3.5;p.cashBufferMonthly=2.5;p.nisaMonthly=4;
  const projection=x.modelYears(p.propertyPrice,true);
  const month=x.fpMonthlyLedger(projection.points[0]).months[0];
  const expected=month.income-month.spending-month.investing-month.cashGoal-month.buffer;
  assert.ok(Math.abs(month.available-expected)<1e-8);
  assert.equal(month.cashGoal,3.5);
  assert.equal(month.buffer,2.5);
  assert.ok(Math.abs(month.endingCash-month.openingCash-month.net)<1e-8);
  const pie=x.fpMonthlyAllocation(month);
  assert.ok(pie.items.some(i=>i.id==='investing'&&Math.abs(i.amount-(month.investing+month.cashGoal+month.buffer))<1e-8));
  assert.equal(pie.items.length,5,'Donut retains its previous five-item footprint');
  assert.ok(Math.abs(pie.remaining-Math.max(0,month.available))<1e-8);
  assert.match(x.fpMonthlyReport(projection),/全て引いた残額/);
});

test('negative balances are marked negative and mortgage interest is not confused with principal',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.husbandMonthly=0;p.wifeMonthly=0;p.wifeReduced=0;
  const projection=x.modelYears(p.propertyPrice,true);
  const html=x.fpMonthlyReport(projection);
  assert.match(html,/fp-month-final negative/);
  const years=35,principal=4400,payment=x.mortgageMonthly(principal,0,1.5,years);
  const total=payment*years*12;
  assert.ok(total>principal);
  const loan=x.fpLoanSummary(principal);
  assert.match(loan,/借入元金（利息を含まない）/);
  assert.match(loan,/金利込み・月々の返済/);
  assert.match(loan,/金利込み・総返済額/);
  assert.match(loan,/× 420回/);
  const matches=loan.match(/class="fp-loan-with-interest"/g)||[];
  assert.equal(matches.length,2);
  const shown=loan.match(/金利込み・月々の返済<\/span><strong>([\d,]+)円<\/strong>[\s\S]*?× (\d+)回[\s\S]*?金利込み・総返済額<\/span><strong>([\d,]+)円<\/strong>/);
  assert.ok(shown,'Payment × term = total relationship must be shown');
  assert.equal(Number(shown[1].replace(/,/g,''))*Number(shown[2]),Number(shown[3].replace(/,/g,'')));
});

test('cash goal deadline also updates monthly final remainder',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.goalCashEnabled=1;p.goalCashAmount=800;p.goalCashYears=2;
  p.simulateUntil=now()+10;
  const projection=x.modelYears(p.propertyPrice,true);
  const before=x.fpMonthlyLedger(projection.points[0]).months[0];
  const later=x.fpMonthlyLedger(projection.points.find(i=>i.year===now()+3)).months[0];
  assert.ok(before.cashGoal>0);
  assert.equal(later.cashGoal,0);
});


test('living and children itemization reconciles for every year and representative month',()=>{
  const x=loadFinance(),p=x.state.plan;
  Object.assign(p,{
    children:2,firstChildYear:now(),birthInterval:2,
    childLivingMonthly:4,daycareMonthly:3,childInsuranceMonthly:.8,
    childEducationInsuranceMonthly:1.5,
    foodMonthly:5,electricityMonthly:1.5,gasMonthly:1,waterBiMonthly:1,
    telecomMonthly:1.2,leisureMonthly:2,carMonthly:2,
    annualTax:10,carTaxAnnual:5,travelAnnual:12,annualEvents:8,
    expenses:Array.from({length:12},(_,i)=>({
      id:'extra-'+i,name:'その他追加費'+i,amount:.1,cycle:'month',start:0,end:0
    }))
  });
  const projection=x.modelYears(p.propertyPrice,true);
  for(const year of [now(),now()+2,now()+6,now()+15]){
    const point=projection.points.find(row=>row.year===year);
    for(const monthNumber of [1,6,12]){
      const month=x.fpMonthlyLedger(point).months[monthNumber-1];
      const allocation=x.fpMonthlyAllocation(month);
      const living=allocation.items.find(i=>i.id==='living');
      const details=x.fpPieBreakdownRows(point,month,'living');
      const detailTotal=details.reduce((acc,row)=>acc+row.amount,0);
      assert.ok(Math.abs(detailTotal-living.amount)<1e-8,
        year+'-'+monthNumber+' living and child itemization must match allocation');
      if(year>=p.firstChildYear){
        for(const name of ['子どもの保険','子どもの生活費'])
          assert.ok(details.some(row=>row.label===name),'Missing '+name);
        const ages=[0,1].map(i=>year-(p.firstChildYear+i*p.birthInterval));
        if(ages.some(age=>age>=0&&age<6))
          assert.ok(details.some(row=>row.label==='保育料・幼稚園'),'Missing preschool cost');
        else assert.ok(!details.some(row=>row.label==='保育料・幼稚園'),
          'Preschool expenses should end when children are older');
      }
    }
    const incomePie=x.fpIncomeAllocation(point);
    for(const category of ['living','education','housing']){
      const item=incomePie.items.find(i=>i.id===category);
      const sum=x.fpPieBreakdownRows(point,null,category).reduce((acc,row)=>acc+row.amount,0);
      assert.ok(Math.abs(sum-item.amount)<1e-8,year+' '+category+' annual detail mismatch');
    }
  }
});

test('long living-detail lists display all child costs first and every other row is reachable without scrolling',()=>{
  const x=loadFinance(),p=x.state.plan;
  Object.assign(p,{
    children:2,firstChildYear:now(),birthInterval:1,
    childLivingMonthly:4,daycareMonthly:2,childInsuranceMonthly:.5,
    childEducationInsuranceMonthly:1.5,
    foodMonthly:4,gasMonthly:1,electricityMonthly:1.2,
    telecomMonthly:1.5,lifeInsuranceMonthly:1,carMonthly:2,
    expenses:Array.from({length:26},(_,i)=>({
      id:'extra-'+i,name:'登録済み追加費'+i,amount:.1,cycle:'month',start:0,end:0
    }))
  });
  const projection=x.modelYears(p.propertyPrice,true);
  const point=projection.points[1];
  const month=x.fpMonthlyLedger(point).months[0];
  const allocation=x.fpMonthlyAllocation(month);
  const rows=x.fpPieBreakdownRows(point,month,'living');
  assert.ok(rows.length>24,'must exercise a genuinely overflowing detail');
  const covered=[];
  for(let page=0;page<Math.ceil(rows.length/8);page++){
    x.ui.fpBreakdownPageIndex=page;
    const markup=x.fpPieBreakdownPanel(point,month,allocation.items,'living');
    assert.match(markup,/--fp-cols:4/);
    assert.match(markup,/data-act="fp-breakdown-page"/);
    assert.match(markup,new RegExp((page+1)+'/'+Math.ceil(rows.length/8)));
    const itemCount=(markup.match(/class="fp-breakdown-row"/g)||[]).length;
    assert.equal(itemCount,Math.min(8,rows.length-page*8));
    const labels=[...markup.matchAll(/<span class="fp-row-label">([^<]+)<\/span>/g)].map(m=>m[1]);
    covered.push(...labels);
    if(page===0){
      assert.match(markup,/子どもの生活費/);
      assert.match(markup,/保育料・幼稚園/);
      assert.match(markup,/学資保険/);
    }
  }
  assert.equal(covered.length,rows.length);
  for(const row of rows)assert.ok(covered.includes(row.label),'hidden expense '+row.label);
});

test('before first birth, child costs do not disappear silently without explanation',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.children=2;p.firstChildYear=now()+2;p.birthInterval=3;
  const point=x.modelYears(p.propertyPrice,true).points[0];
  const month=x.fpMonthlyLedger(point).months[0];
  const allocation=x.fpMonthlyAllocation(month);
  const html=x.fpPieBreakdownPanel(point,month,allocation.items,'living');
  assert.match(html,new RegExp('子ども費は'+p.firstChildYear+'年の出生予定から順次計上'));
});
