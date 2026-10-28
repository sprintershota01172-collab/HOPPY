'use strict';
// Run: node --test tests/finance.test.cjs
// Offline, deterministic tests against the same functions used by the PWA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadFinance(seed=null,shortViewport=false,cardHeight=null){
  const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const marker='\n  save();render();\n  // The startup';
  assert.equal(source.split(marker).length,2,'App test anchor changed');
  const bridge='\n  globalThis.__finance = {state,ui,defaultPlan,fpBudget,fpRating,fpMortgageCapacityCard,mortgageMonthly,modelYears,fpMonthlyLedger,fpEducationFundYears,fpSchoolBreakdown,fpCashGoalForYear,fpAdviceData,fpHouseholdCashSavings,fpSyncHouseholdCashSavings,fpLoanSummary,fpMonthlyReport,fpMonthlyAllocation,fpIncomeAllocation,fpPieBreakdownRows,fpPieBreakdownPanel,fpBreakdownPageSize,fpWizardPages,fpOfficialChildBenefit,fpMonthlyIncome,fpAmortization,educationAnnual,fpBaseMonthly,fpForecast}; return;\n  // The startup';
  const grid={};
  const title={getBoundingClientRect(){return {height:39}}};
  const panel={getBoundingClientRect(){return {height:cardHeight}},
    querySelector(s){return s==='.fp-breakdown-title'?title:s==='.fp-breakdown-list'?grid:null}};
  const host={querySelector(s){return s==='.fp-breakdown-panel'?panel:null}};
  const app={addEventListener(){},
    querySelector(s){return cardHeight!==null&&s==='.fp-month-report'?host:null},
    querySelectorAll(){return []}};
  const ctx={
    document:{getElementById:()=>app,addEventListener(){},querySelectorAll(){return []}},
    window:{matchMedia:q=>({matches:shortViewport&&q.includes('max-height:860px')}),addEventListener(){},crypto:{},
      getComputedStyle(el){return el===panel?
        {paddingTop:'6px',paddingBottom:'7px',rowGap:'3px'}:
        {rowGap:'4px',getPropertyValue:()=> '38px'};}},
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
  assert.match(html,/家計から計算した、無理の少ない物件価格の目安/);
  assert.match(html,/検討中の物件価格/);
  assert.match(html,/支払った後の残額/);
  assert.match(html,/ローン返済（金利込み）/);
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
  const perPage=x.fpBreakdownPageSize('monthly');
  assert.equal(perPage,12,'default bootstrap shows three rows');
  for(let page=0;page<Math.ceil(rows.length/perPage);page++){
    x.ui.fpBreakdownPageIndex=page;
    const markup=x.fpPieBreakdownPanel(point,month,allocation.items,'living');
    assert.match(markup,/--fp-cols:4/);
    assert.match(markup,/data-act="fp-breakdown-page"/);
    assert.match(markup,new RegExp((page+1)+'/'+Math.ceil(rows.length/perPage)));
    const itemCount=(markup.match(/class="fp-breakdown-row"/g)||[]).length;
    assert.equal(itemCount,Math.min(perPage,rows.length-page*perPage));
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


test('short mobile viewport initially fills two rows without cutting the total',()=>{
  const x=loadFinance(null,true),p=x.state.plan;
  p.children=2;p.firstChildYear=now();p.birthInterval=1;
  p.childLivingMonthly=2;p.daycareMonthly=2;
  p.childEducationInsuranceMonthly=1;p.childInsuranceMonthly=.4;
  p.foodMonthly=4;p.electricityMonthly=1.1;p.gasMonthly=.5;
  const point=x.modelYears(p.propertyPrice,true).points[1],
    month=x.fpMonthlyLedger(point).months[0],
    alloc=x.fpMonthlyAllocation(month),
    rows=x.fpPieBreakdownRows(point,month,'living');
  const perPage=x.fpBreakdownPageSize('monthly');
  assert.equal(perPage,8);
  assert.ok(rows.length>perPage);
  const first=x.fpPieBreakdownPanel(point,month,alloc.items,'living');
  assert.equal((first.match(/class="fp-breakdown-row"/g)||[]).length,perPage);
  assert.match(first,/class="fp-breakdown-pager"/);
  assert.match(first,/全\d+件/);
  x.ui.fpBreakdownPageIndex=1;
  const second=x.fpPieBreakdownPanel(point,month,alloc.items,'living');
  assert.match(second,/2\/\d+/);
  assert.equal((second.match(/class="fp-breakdown-row"/g)||[]).length,
    Math.min(perPage,rows.length-perPage));
});

test('measured card capacity fills unused space without changing four-column pitch',()=>{
  const compact=loadFinance(null,false,130);
  const medium=loadFinance(null,false,220);
  const tall=loadFinance(null,false,300);
  assert.equal(compact.fpBreakdownPageSize('monthly'),4);
  assert.equal(medium.fpBreakdownPageSize('monthly'),12);
  assert.equal(tall.fpBreakdownPageSize('monthly'),20);
  const p=medium.state.plan;
  p.children=2;p.firstChildYear=now();p.birthInterval=1;
  p.childLivingMonthly=3;p.childInsuranceMonthly=.3;p.daycareMonthly=2;
  p.expenses=Array.from({length:22},(_,i)=>({
    id:'fit-'+i,name:'追加費'+i,amount:.2,cycle:'month',start:0,end:0
  }));
  const point=medium.modelYears(p.propertyPrice,true).points[1];
  const month=medium.fpMonthlyLedger(point).months[0];
  const allocation=medium.fpMonthlyAllocation(month);
  const html=medium.fpPieBreakdownPanel(point,month,allocation.items,'living');
  assert.equal((html.match(/class="fp-breakdown-row"/g)||[]).length,12);
  assert.match(html,/data-fp-cols="4" data-fp-rows="3"/);
  assert.match(html,/class="fp-breakdown-pager"/);
});


test('head money lowers actual loan principal and consumes cash at purchase, once',()=>{
  const x=loadFinance(),p=x.state.plan;
  p.propertyPrice=4000;p.downPayment=500;p.purchaseYear=now()+1;p.purchaseMonth=7;
  p.interest=1.5;p.loanYears=35;p.children=0;
  const loan=x.fpAmortization(4000);
  assert.equal(loan.principal,3500);
  const monthlyRate=0.015/12,period=420;
  const expected=3500*monthlyRate/(1-Math.pow(1+monthlyRate,-period));
  assert.ok(Math.abs(loan.monthly-expected)<1e-9);
  assert.ok(Math.abs(x.fpForecast(4000).payment-expected)<1e-9);
  const model=x.modelYears(4000,true);
  const point=model.points.find(x=>x.year===p.purchaseYear);
  assert.equal(point.upfront,780,'500 head + 7% transaction costs');
  const monthly=x.fpMonthlyLedger(point).months;
  assert.ok(Math.abs(monthly[6].purchase-780)<1e-8);
  assert.ok(monthly.filter(row=>row.purchase>0).length===1,'purchase payment only once');
  assert.ok(Math.abs(monthly[11].endingCash-point.cash)<1e-6,'annual vs monthly cash');
  const budget=x.fpBudget();
  assert.ok(Math.abs(budget.amount-(budget.loanPrincipal+500))<.001);
  const summary=x.fpLoanSummary(4000);
  assert.match(summary,/35,000,000円/,'borrowing excludes head money');
  assert.match(summary,/頭金 5,000,000円/);
});

test('statutory child allowance is an optional bimonthly age-based estimate',()=>{
  const x=loadFinance(),p=x.state.plan,y=now()+1;
  Object.assign(p,{children:3,firstChildYear:y,birthInterval:1,childBenefitMode:'official'});
  assert.equal(x.fpOfficialChildBenefit(y,1,p),0);
  assert.equal(x.fpOfficialChildBenefit(y,2,p),3);
  assert.equal(x.fpOfficialChildBenefit(y+2,2,p),12,'two preschool + third child');
  assert.equal(x.fpOfficialChildBenefit(y+3,2,p),11,'3 years and older falls to 10,000');
  assert.equal(x.fpOfficialChildBenefit(y+23,2,p),0);
  const annual=Array.from({length:12},(_,i)=>x.fpMonthlyIncome(y+2,i+1).fields.childBenefits)
    .reduce((a,b)=>a+b,0);
  assert.equal(annual,72,'6 payments of 12 ten-thousand JPY');
  p.childBenefitMode='manual';p.childBenefitMonthly=2;
  assert.equal(x.fpMonthlyIncome(y+2,1).fields.childBenefits,6,'manual legacy remains');
});

test('optional future cost escalation respects fixed premiums and education funding',()=>{
  const x=loadFinance(),p=x.state.plan,y=now();
  Object.assign(p,{children:1,firstChildYear:y,foodMonthly:4,carMonthly:2,carLoanEndYear:y+6,
    childInsuranceMonthly:.5,educationInflationAnnual:3,livingInflationAnnual:2});
  const begin=x.fpBaseMonthly(y),future=x.fpBaseMonthly(y+5);
  const by=(parts,key)=>parts.find(item=>item.key===key).value;
  assert.ok(Math.abs(by(future,'foodMonthly')-4*Math.pow(1.02,5))<1e-8);
  assert.equal(by(future,'carMonthly'),2,'contractual loan not inflated');
  assert.equal(by(future,'childInsuranceMonthly'),.5,'insurance premium stays nominal');
  assert.ok(Math.abs(x.educationAnnual(9,p,y+9)-34*Math.pow(1.03,9))<1e-8);
  const point=x.modelYears(p.propertyPrice,true).points.find(item=>item.year===y+5);
  const ledger=x.fpMonthlyLedger(point);
  assert.ok(Math.abs(ledger.ending-point.cash)<1e-6,'cashflow still reconciles under inflation');
});

test('future-year repayment gap is evaluated AFTER actual loan payment',()=>{
  const x=loadFinance(),p=x.state.plan;
  Object.assign(p,{children:2,firstChildYear:now()+2,birthInterval:3,
    childLivingMonthly:6,daycareMonthly:3,foodMonthly:5,electricityMonthly:1.2,
    propertyPrice:3000,interest:1.5,loanYears:35,downPayment:0});
  const b=x.fpBudget(),loan=x.fpAmortization(p.propertyPrice);
  const worstActual=b.worstSurplus-loan.monthly;
  assert.ok(worstActual<b.worstSurplus);
  const card=x.fpMortgageCapacityCard();
  assert.match(card,/将来の厳しい年/);
  assert.match(card,/金利が当初から＋1％なら月返済/);
  assert.match(card,/購入月末の現金見込/);
  assert.match(card,/銀行審査は別/);
});


test('rent switches to mortgage in the exact month and annual cash agrees across 4 purchase dates',()=>{
  const x=loadFinance(),p=x.state.plan,y=now()+2;
  Object.assign(p,{children:0,propertyPrice:4000,purchaseYear:y,downPayment:400,
    rentMonthly:8,managementMonthly:.5,commonFeeMonthly:0,parkingMonthly:.5,
    housingOngoing:2,interest:1.5,loanYears:35,
    weddingCost:0,honeymoonCost:0,expenses:[],events:[],simulateUntil:y+10});
  for(const purchaseMonth of [1,5,9,12]){
    p.purchaseMonth=purchaseMonth;
    const loan=x.fpAmortization(4000);
    assert.equal(loan.principal,3600);
    assert.ok(Math.abs(loan.months.reduce((sum,e)=>sum+e.principalPaid,0)-3600)<1e-7);
    const point=x.modelYears(4000,true).points.find(item=>item.year===y);
    const ledger=x.fpMonthlyLedger(point);
    assert.equal(point.ownedMonths,13-purchaseMonth);
    assert.equal(point.rentMonths,purchaseMonth-1);
    for(const row of ledger.months){
      const owner=row.month>=purchaseMonth;
      const want=owner?loan.monthly+2:9;
      assert.ok(Math.abs(row.housing-want)<1e-8,
        'housing month '+purchaseMonth+'/'+row.month);
      assert.ok(Math.abs(row.purchase-(row.month===purchaseMonth?680:0))<1e-8);
      const items=x.fpPieBreakdownRows(point,row,'housing');
      assert.ok(Math.abs(items.reduce((sum,e)=>sum+e.amount,0)-row.housing)<1e-8);
      assert.equal(items.some(item=>item.label==='家賃'),!owner);
      assert.equal(items.some(item=>item.label.startsWith('住宅ローン返済')),owner);
    }
    assert.ok(Math.abs(ledger.months.reduce((sum,row)=>sum+row.spending,0)-point.expenses)<1e-7);
    assert.ok(Math.abs(ledger.ending-point.cash)<1e-7);
  }
});
