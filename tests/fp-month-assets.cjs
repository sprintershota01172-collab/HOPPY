// HOPPY FP monthly cashflow: annual reconciliation, timed events, and cash/NISA/other asset balances.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(source.includes(anchor));
source=source.replace(anchor,
 "  window.__cashTest={getPlan:()=>state.plan,modelYears,fpMonthlyLedger,fpAssetsForYear,fpMonthlyAssets,fpYearlyIncome,fpMonthlyAllocation,fpMonthlyPie};\n"+anchor);
const store={},listeners={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return []},
 contains(){return true},addEventListener(k,fn){listeners[k]=fn},insertAdjacentHTML(){}};
let n=0,clock=1000;
class FakeDate extends Date{static now(){return clock+=1500;}}
const win={matchMedia(){return {matches:false}},crypto:{randomUUID(){return String(++n)}},addEventListener(){}};
vm.runInNewContext(source,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'invalid.test'},Date:FakeDate,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const click=(action,value='')=>listeners.click({target:{closest(){return {dataset:{act:action,value}}}},preventDefault(){}});
const changeYear=y=>listeners.change({target:{dataset:{fpYear:''},value:String(y)}});
const api=win.__cashTest,p=api.getPlan();
Object.assign(p,{children:0,cashSavings:1000,support:0,nisaBalance:50,investBalance:20,
 nisaMonthly:3,otherInvestMonthly:1,returnAnnual:5,propertyPrice:4500,purchaseYear:2027,
 loanYears:35,weddingCost:0,honeymoonCost:0,expenses:[],simulateUntil:2045});
p.events=[
 {id:'w',name:'結婚式',year:2027,month:2,type:'expense',amount:250,kind:'wedding'},
 {id:'travel',name:'旅行',year:2027,month:0,type:'expense',amount:120,kind:'custom'},
 {id:'gift',name:'臨時収入',year:2027,month:8,type:'income',amount:70,kind:'custom'}];
const model=api.modelYears(p.propertyPrice,true);
for(const year of [2026,2027,2028,2035]){
 const point=model.points.find(x=>x.year===year);
 assert.ok(point,'forecast point '+year);
 const ledger=api.fpMonthlyLedger(point);
 const sum=(key)=>ledger.months.reduce((a,x)=>a+x[key],0);
 const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,label+': '+a+' ≠ '+b);
 close(sum('income'),point.incomes,'income '+year);
 close(sum('spending'),point.expenses,'spending '+year);
 close(sum('investing'),point.investing,'investing '+year);
 close(sum('net'),point.netCash,'net '+year);
 close(ledger.ending,point.cash,'end cash '+year);
 close(ledger.months[0].openingCash,ledger.opening,'opening '+year);
 close(ledger.months[11].endingCash,point.cash,'December balance '+year);
 const december=api.fpMonthlyAssets(model,year,12);
 close(december.nisa,point.nisa,'December NISA '+year);
 close(december.otherInvest,point.otherInvest,'December other investments '+year);
 close(december.cash,point.cash,'December cash '+year);
 close(december.total,point.total,'December total '+year);
}
const y2027=model.points.find(x=>x.year===2027),led=api.fpMonthlyLedger(y2027);
assert.ok(led.months[0].purchase>300,'house purchase up-front costs in January');
assert.equal(led.months[1].eventExpenses,260,'timed February event + unallocated event/12');
assert.equal(led.months[2].eventExpenses,10,'event with unknown month is spread');
assert.equal(led.months[7].income,api.fpMonthlyAssets(model,2027,8).month&&api.fpYearlyIncome(2027).months[7].total);
assert.ok(led.months[1].net<led.months[2].net,'February event causes larger deficit');
for(const month of led.months){
 const allocation=api.fpMonthlyAllocation(month);
 assert.ok(Math.abs(allocation.spent-month.spending)<1e-8,'monthly spending sum '+month.month);
 assert.ok(Math.abs(allocation.items.reduce((a,x)=>a+x.amount,0)-Math.max(month.income,month.spending+month.investing))<1e-8,
   'donut segment sum '+month.month);
 assert.equal(allocation.percent,month.income>0?month.spending/month.income*100:null);
 assert.ok(api.fpMonthlyPie(month).includes('支出率'));
}
assert.ok(api.fpMonthlyAllocation(led.months[1]).percent>100,'exceptional wedding month exceeds ordinary income');
const zeroIncome={...led.months[0],income:0,net:-led.months[0].spending-led.months[0].investing};
assert.equal(api.fpMonthlyAllocation(zeroIncome).percent,null,'zero income handled without division by zero');
assert.match(api.fpMonthlyPie(zeroIncome),/支出率は算出できません/);
const firstMonth=api.fpMonthlyAssets(model,2027,1);
assert.ok(firstMonth.nisa>model.points.find(x=>x.year===2026).nisa,'NISA balance grows with contributions and returns');
assert.ok(firstMonth.otherInvest>model.points.find(x=>x.year===2026).otherInvest);
assert.ok(Math.abs(firstMonth.cash-led.months[0].endingCash)<1e-8);
click('tab','sim');for(let i=0;i<7;i++)click('sim-next');
assert.match(app.innerHTML,/data-fp-cash-month/);
click('fp-result-tab','1');
assert.match(app.innerHTML,/data-fp-cash-month/);
assert.match(app.innerHTML,/月末現金/);
assert.match(app.innerHTML,/手取り収入に対する割合/);
assert.match(app.innerHTML,/投資積立/);
assert.match(app.innerHTML,/data-fp-cash-month/);
assert.doesNotMatch(app.innerHTML,/fp-month-bar/,'unnecessary bar chart has been removed');
assert.match(app.innerHTML,/data-fp-month-pie/);
assert.match(app.innerHTML,/円グラフ/);
assert.match(app.innerHTML,/支出率/);
click('fp-month-view','detail');
assert.match(app.innerHTML,/fp-cash-rows/);
assert.doesNotMatch(app.innerHTML,/data-fp-month-pie/);
click('fp-month-view','pie');
assert.match(app.innerHTML,/data-fp-month-pie/);
listeners.change({target:{dataset:{fpCashMonth:''},value:'2'}});
assert.match(app.innerHTML,/月収支/);
changeYear(2027);
assert.match(app.innerHTML,/2027年/,'year remains visible in the year picker');
assert.match(app.innerHTML,/2027年2月の手取り収入に対する支出割合/);
click('fp-result-tab','3');
assert.match(app.innerHTML,/年収支/);
click('fp-result-tab','2');
assert.match(app.innerHTML,/fp-assets-report/);
assert.match(app.innerHTML,/現金預金/);
assert.match(app.innerHTML,/NISA評価額/);
assert.match(app.innerHTML,/その他の株式・投資/);
assert.match(app.innerHTML,/金融資産の合計/);
assert.match(app.innerHTML,/fp-r-chart/);
click('fp-asset-period','month');
assert.match(app.innerHTML,/fp-assets-months/);
click('fp-asset-month','8');
assert.match(app.innerHTML,/2027年 8月末/);
click('fp-asset-period','year');
assert.match(app.innerHTML,/2027年 年末/);
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-month-report,.fp-assets-report\{[^}]*overflow:hidden!important/);
assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)!important/);
assert.match(css,/\.fp-month-pie\{/);
console.log('HOPPY monthly income/outflow/net and separate cash/NISA/equity asset balance: PASS');