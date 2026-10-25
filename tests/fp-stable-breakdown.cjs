// FP interactions must keep the whole page stationary and expose every
// breakdown row within the same scrolling report, including on small phones.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let source=fs.readFileSync('app.js','utf8');
const anchor="  save();render();\n  if('serviceWorker'";
assert.ok(source.includes(anchor));
source=source.replace(anchor,
 "  window.__fpStable={state,ui,modelYears,fpMonthlyLedger,fpPieBreakdownRows,fpPieBreakdownPanel};\n"+anchor);
let stored={},renders=0,html='',hostMode=null;
const handlers={};
const counters={};
const app={
  get innerHTML(){return html;},set innerHTML(value){renders++;html=value;},
  addEventListener(event,fn){handlers[event]=fn;},contains(){return true},
  insertAdjacentHTML(){},
  querySelector(selector){
    if(hostMode==='monthly' && selector==='.fp-month-report')return host;
    if(hostMode==='annual' && selector==='.fp-pie-panel')return host;
    return null;
  },
  querySelectorAll(){return []}
};
const panel={_html:'',get outerHTML(){return this._html;},set outerHTML(html){this._html=html;}};
const makeChoice=(name,type,period)=>{
  const tokens=new Set([type]);
  return {
    dataset:{value:name,period},attributes:{},classList:{
      contains(key){return tokens.has(key);},
      toggle(key,value){if(value)tokens.add(key);else tokens.delete(key);},
      has(key){return tokens.has(key);}
    },
    setAttribute(key,val){this.attributes[key]=val}
  };
};
const choiceLiving=makeChoice('living','fp-pie-pick','monthly');
const choiceHousing=makeChoice('housing','fp-pie-pick','monthly');
const arcHousing=makeChoice('housing','fp-pie-arc','monthly');
const host={
  scrollTop:73,
  querySelector(selector){return selector==='.fp-breakdown-panel'?panel:null;},
  querySelectorAll(selector){return selector==='[data-act="fp-breakdown-select"]'?
   [choiceLiving,choiceHousing,arcHousing]:[]}
};
const click=(act,value='',period='')=>handlers.click({
 target:{closest(){return {dataset:{act,value,period}};}},preventDefault(){}
});
let seq=0,clock=1000;
class FixedDate extends Date{static now(){return clock+=1000;}}
const win={
 matchMedia(){return {matches:false}},
 crypto:{randomUUID(){return String(++seq)}},
 addEventListener(){}
};
vm.runInNewContext(source,{
 document:{getElementById(){return app}},window:win,
 localStorage:{getItem(k){return stored[k]||null},setItem(k,v){stored[k]=v}},
 navigator:{},location:{protocol:'http:',hostname:'example.invalid'},
 Date:FixedDate,crypto:win.crypto,confirm(){return true},
 setTimeout(){return 0},clearTimeout(){},Intl,console,URL,Number,Math,Array,JSON,String,Promise
},{filename:'app.js'});
const api=win.__fpStable,p=api.state.plan;
Object.assign(p,{children:0,purchaseYear:2028,purchaseMonth:9,
 propertyPrice:4400,foodMonthly:3.5,livingMonthly:4,
 rentMonthly:8,managementMonthly:.5,parkingMonthly:.5,
 electricityMonthly:1,gasMonthly:.5,waterBiMonthly:.7,
 nisaMonthly:3,otherInvestMonthly:1,
 expenses:[{id:'added-1',name:'追加月額費',amount:.3,cycle:'month',start:0,end:0}],
 events:[],weddingCost:0,honeymoonCost:0});
click('tab','sim');
for(let i=0;i<7;i++)click('sim-next');
assert.match(html,/fp-month-pie/);
assert.match(html,/data-fp-inline-breakdown/);

hostMode='monthly';
const rendersBefore=renders;
click('fp-breakdown-select','housing','monthly');
assert.equal(renders,rendersBefore,'changing the category must NOT rebuild app.innerHTML');
assert.equal(host.scrollTop,73,'the report scroll position is preserved');
assert.match(panel.outerHTML,/家賃/,'selected housing breakdown is shown');
assert.match(panel.outerHTML,/data-fp-inline-breakdown/);
assert.equal(choiceHousing.classList.has('selected'),true);
assert.equal(choiceLiving.classList.has('selected'),false);
assert.equal(choiceHousing.attributes['aria-pressed'],'true');
assert.equal(arcHousing.attributes['stroke-width'],'33');
click('fp-breakdown-select','living','monthly');
assert.equal(renders,rendersBefore,'a second category tap must also stay in place');
assert.match(panel.outerHTML,/追加月額費/,'late-added expense must be in the complete list');
assert.match(panel.outerHTML,/その他の生活費/);
const renderedRows=(panel.outerHTML.match(/class="fp-breakdown-row"/g)||[]).length;
assert.ok(renderedRows>=7,'every registered expense is present in the compact list: '+renderedRows);
assert.doesNotMatch(panel.outerHTML,/data-fp-breakdown-field=/,'editing controls are not repeated on every expense row');
assert.equal(host.scrollTop,73);

hostMode=null;
click('fp-result-tab','3');
click('fp-chart-page','3');
assert.match(html,/fp-pie-chart/);
hostMode='annual';
host.scrollTop=91;
const annualCount=renders;
click('fp-breakdown-select','living','annual');
assert.equal(renders,annualCount,'annual category selection must not redraw the whole screen');
assert.equal(host.scrollTop,91);
assert.match(panel.outerHTML,/生活費・保険等の内訳/);
assert.match(panel.outerHTML,/追加月額費/);

const css=fs.readFileSync('styles.css','utf8');
assert.match(css,/\.fp-focus \.fp-breakdown-list\s*\{[^}]*display:grid!important/);
assert.match(css,/\.fp-focus \.fp-breakdown-list.two-columns\s*\{[^}]*grid-template-columns:repeat\(2/);
assert.match(css,/\.fp-focus \.fp-breakdown-list\s*\{[^}]*overflow:hidden!important/);
assert.match(css,/\.main > \.fp-result-screen\s*\{animation:none!important/);
assert.match(css,/\.fp-focus \.fp-breakdown-row \.fp-row-label\s*\{[^}]*white-space:normal!important/);
console.log('HOPPY FP stable selections: no app redraw, no scroll reset, '+renderedRows+' available expense entries PASS');
