// FP r16: all visible monetary fields are yen, only nonzero items are shown,
// and free spending / cash savings goals follow distinct accounting rules.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let js=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  // The startup wordmark";
assert.ok(js.includes(anchor));
js=js.replace(anchor,
 "  window.__yenTest={getState:()=>state,ui,modelYears,fpMonthlyLedger,fpPieBreakdownRows,fpPieBreakdownPanel,fpYen,fpYenNumber};\n"+anchor);
const storage={},events={},app={innerHTML:'',querySelector(){return null},querySelectorAll(){return[]},
 contains(){return true},addEventListener(k,fn){events[k]=fn},insertAdjacentHTML(){}};
let seq=0,tick=1000;
class DateMock extends Date{static now(){return tick+=2100}}
const win={matchMedia(){return{matches:false}},crypto:{randomUUID(){return String(++seq)}},addEventListener(){}};
vm.runInNewContext(js,{document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'example.invalid'},Date:DateMock,
 crypto:win.crypto,confirm(){return true},setTimeout(){return 0},clearTimeout(){},
 Intl,console,URL,Number,Math,Array,JSON,String,Promise},{filename:'app.js'});
const api=win.__yenTest,p=api.getState().plan;
const click=(act,value='',period='')=>events.click({target:{closest(){return{dataset:{act,value,period}}}},preventDefault(){}});
const input=(dataset,value)=>events.input({target:{dataset,value,hasAttribute(){return false}}});
const change=(dataset,value)=>events.change({target:{dataset,value}});
p.children=0;p.weddingCost=0;p.honeymoonCost=0;p.events=[];
p.expenses=[];p.nisaMonthly=3;p.otherInvestMonthly=0;p.otherSavingsMonthly=0;
p.freeSpendingMonthly=0;p.foodMonthly=0;p.electricityMonthly=0;
const before=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2026);
const startingNet=before.netCash;
assert.equal(api.fpYen(19.55),'195,500円');
click('tab','sim');
click('sim-next');click('sim-next');click('sim-next');
assert.match(app.innerHTML,/円\/月/,'wizard uses yen units');
assert.match(app.innerHTML,/data-sim-yen="true"/,'wizard monetary inputs flagged for conversion');
input({sim:'foodMonthly',simYen:'true'},'28000');
input({sim:'freeSpendingMonthly',simYen:'true'},'50000');
assert.equal(p.foodMonthly,2.8);
assert.equal(p.freeSpendingMonthly,5);
assert.ok(Math.abs(api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2026).netCash-
 (startingNet-(2.8+5)*12))<1e-7,'spending reduces annual cash forecast');
for(let i=0;i<4;i++)click('sim-next');
assert.match(app.innerHTML,/data-fp-cash-month/);
assert.match(app.innerHTML,/class="fp-month-quick"/);
assert.match(app.innerHTML,/data-fp-quick-key="freeSpendingMonthly"/);
assert.match(app.innerHTML,/value="50000"/);
assert.match(app.innerHTML,/data-fp-quick-key="otherSavingsMonthly"/);
assert.match(app.innerHTML,/食費/);
assert.match(app.innerHTML,/28,000円/);
const point=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2026);
const jan=api.fpMonthlyLedger(point).months[0];
const living=api.fpPieBreakdownRows(point,jan,'living');
assert.ok(living.some(x=>x.label==='自由費'&&Math.abs(x.amount-5)<1e-8));
assert.ok(living.some(x=>x.label==='食費'&&Math.abs(x.amount-2.8)<1e-8));
assert.ok(!living.some(x=>x.label==='ガス' || x.label==='電気'),'zero fields hidden');
assert.equal((app.innerHTML.match(/data-act="fp-row-edit"/g)||[]).length,living.length,
 'each registered spending field appears exactly once in the selected detail');
const netBeforeGoal=point.netCash;
change({fpQuickKey:'otherSavingsMonthly'},'80000');
assert.equal(p.otherSavingsMonthly,8);
const afterGoal=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2026);
assert.equal(afterGoal.netCash,netBeforeGoal,'savings target is an allocation, not a cash expense');
const remainingRows=api.fpPieBreakdownRows(afterGoal,api.fpMonthlyLedger(afterGoal).months[0],'remaining');
const remainingPie=Math.max(0,api.fpMonthlyLedger(afterGoal).months[0].net);
assert.ok(Math.abs(remainingRows.reduce((sum,row)=>sum+row.amount,0)-remainingPie)<1e-8);
click('fp-row-edit','field|foodMonthly','monthly');
assert.match(app.innerHTML,/data-fp-breakdown-field="foodMonthly"/);
assert.match(app.innerHTML,/value="28000"/);
change({fpBreakdownField:'foodMonthly'},'36000');
assert.equal(p.foodMonthly,3.6);
assert.match(app.innerHTML,/36,000円/,'edited yen displayed without changing accounting units');
p.expenses=Array.from({length:13},(_,i)=>({id:'custom'+i,name:'追加費'+i,amount:.1,cycle:'month',start:0,end:0}));
const densePoint=api.modelYears(p.propertyPrice,true).points.find(x=>x.year===2026),
  denseMonth=api.fpMonthlyLedger(densePoint).months[0],
  denseRows=api.fpPieBreakdownRows(densePoint,denseMonth,'living');
const html=api.fpPieBreakdownPanel(densePoint,denseMonth,[{id:'living',label:'生活・教育費',amount:denseMonth.household}], 'living');
assert.ok(denseRows.length>9);
assert.match(html,/class="fp-breakdown-list two-columns three-columns"/);
assert.equal((html.match(/data-act="fp-row-edit"/g)||[]).length,denseRows.length);
assert.match(html,/data-act="fp-breakdown-page"/,'long expense categories paginate rather than scroll');
assert.match(html,/class="fp-breakdown-row" hidden/,'rows outside active page are present but hidden');
api.ui.fpBreakdownPageMonthly=1;
const page2=api.fpPieBreakdownPanel(densePoint,denseMonth,[{id:'living',label:'生活・教育費',amount:denseMonth.household}], 'living');
assert.match(page2,/2 \/ 2/,'page control shows next page');
assert.match(page2,/追加費12/,'remaining expenses can be reached on the second page');
assert.match(page2,/data-value="-1"/,'previous-page control exists');
const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.app-shell:has\(\.fp-focus\)>header.top\s*\{[^}]*display:none!important/);
assert.match(css,/\.fp-focus>\.fp-bottom-actions\s*\{display:none!important/);
assert.match(css,/\.fp-focus \.fp-breakdown-list\s*\{[^}]*display:grid!important/);
assert.match(css,/\.fp-focus \.fp-breakdown-list\s*\{[^}]*overflow:hidden!important/);
console.log('FP yen input/display, no zero expenses, compact grid, free spending and cash savings goals: PASS');
