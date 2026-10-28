'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const anchor='\n  save();render();\n  // The startup';
assert.equal(source.split(anchor).length,2,'FP test bridge anchor changed');
const bridge='\n  globalThis.__uiTest={fpDashboardMoney,fpMetaDashboard,simulationResultsScreen,ui,state}; return;\n  // The startup';
const app={addEventListener(){},querySelector(){return null;},querySelectorAll(){return []}};
const context={
 document:{getElementById(){return app;},addEventListener(){},querySelectorAll(){return []}},
 window:{matchMedia(){return {matches:false};},addEventListener(){},crypto:{}},
 localStorage:{getItem(){return null;},setItem(){}},
 navigator:{},location:{protocol:'https:',hostname:'localhost'},confirm(){return false;},console
};
vm.runInNewContext(source.replace(anchor,bridge),context,{filename:'app.js',timeout:5000});
const x=context.__uiTest;
test('housing prices use 億 and 万円 while monthly flow uses 円',()=>{
 assert.equal(x.fpDashboardMoney(10043,{large:true}),'1億43万円');
 assert.equal(x.fpDashboardMoney(10000,{large:true}),'1億円');
 assert.equal(x.fpDashboardMoney(3700,{large:true}),'3,700万円');
 assert.equal(x.fpDashboardMoney(6343.3,{large:true,signed:true}),'+6,343万円');
 assert.equal(x.fpDashboardMoney(15.0341,{signed:true}),'+150,341円');
 assert.equal(x.fpDashboardMoney(-6.4,{signed:true}),'−64,000円');
});
test('overview has one navigation row, actions in popup and no duplicated residual amount',()=>{
 x.ui.simResultPage=0;x.ui.fpMoreOpen=false;
 const page=x.simulationResultsScreen(null);
 assert.match(page,/class="fp-result-nav" role="navigation"/);
 assert.doesNotMatch(page,/class="sim-intro"/);
 assert.match(page,/data-act="fp-more-toggle"/);
 assert.doesNotMatch(page,/fp-meta-action-menu/);
 assert.doesNotMatch(page,/fp-meta-remain[^>]*>[^<]*<small>/);
 x.ui.fpMoreOpen=true;
 const open=x.simulationResultsScreen(null);
 assert.match(open,/fp-meta-action-menu/);
 for(const action of ['fp-history-open','fp-edit-events','sim-restart'])assert.match(open,new RegExp('data-act="'+action+'"'));
 assert.match(open,/data-value="7"/);
});
