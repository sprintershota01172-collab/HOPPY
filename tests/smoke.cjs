// ほっぽさん: regression smoke tests (no npm dependencies).
// Run: node tests/smoke.cjs
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const code=fs.readFileSync('app.js','utf8');
const store={};
let seq=0, now=0;
class TestDate extends Date{static now(){return now+=1200;}}
function start(){
  const listeners={};
  const app={
    innerHTML:'',
    addEventListener:(name,fn)=>listeners[name]=fn,
    querySelector:()=>null,
    querySelectorAll:()=>[],
    contains:()=>true,
    insertAdjacentHTML:()=>{}
  };
  const doc={getElementById:()=>app};
  const win={matchMedia:()=>({matches:true}),crypto:{randomUUID:()=>String(++seq)},addEventListener:()=>{}};
  const storage={getItem:key=>store[key]??null,setItem:(key,value)=>store[key]=value};
  const context={document:doc,window:win,localStorage:storage,navigator:{},
    location:{protocol:'http:',hostname:'example.com'},confirm:()=>true,
    setTimeout:()=>0,clearTimeout:()=>{},Date:TestDate,crypto:win.crypto,
    Intl,console,URL,Number,Math,Array,JSON,String,Promise};
  vm.runInNewContext(code,context,{filename:'app.js'});
  return {
    app,
    state:()=>JSON.parse(store['hoppy-phase1-v1']),
    click:(act,value='',extra={})=>{
      const button={dataset:{act,value,...extra}};
      listeners.click({target:{closest:()=>button},preventDefault:()=>{}});
    },
    input:(key,value)=>{
      const el={dataset:key,value,hasAttribute:()=>false};
      listeners.input({target:el});
    }
  };
}
const a=start();
assert.match(a.app.innerHTML,/ほっぽさん/);
assert.match(a.app.innerHTML,/物件を追加/);
assert.match(a.app.innerHTML,/home-search-box/);
assert.match(a.app.innerHTML,/status-chip-row/);
a.click('seed');
assert.equal(a.state().properties.length,3);
assert.equal(a.state().selected.length,3);
assert.match(a.app.innerHTML,/サンプルC/);
assert.match(a.app.innerHTML,/property-list-card/);
a.click('home-status','気になる');
assert.match(a.app.innerHTML,/is-active/);
a.click('home-status','');
a.click('home-page','1');
assert.match(a.app.innerHTML,/home-results/);
a.click('tab','compare');
assert.match(a.app.innerHTML,/物件をくらべる/);
const [p]=a.state().properties;
const [c]=a.state().criteria;
a.click('rating','',{property:p.id,criterion:c.id});
assert.match(a.app.innerHTML,/よい（2点）/);
a.click('score-set','2');
assert.equal(a.state().scores[p.id][c.id].husband,2);
a.click('tab','property');
assert.match(a.app.innerHTML,/property-list-card/);
a.click('home-open',p.id);
assert.match(a.app.innerHTML,/打合せ/);
a.click('detail-close');
a.click('edit-property');
assert.match(a.app.innerHTML,/まとめて保存/);
assert.doesNotMatch(a.app.innerHTML,/STEP [1-4] \/ 4/);
for (const name of ['name','manufacturer','price','kind','age','area','layout','station','status','tags','address','url']) {
  assert.match(a.app.innerHTML,new RegExp('data-model="'+name+'"'));
}
a.input({model:'manufacturer'},'ヘーベルハウス');
a.input({model:'price'},'4350');
a.input({model:'address'},'愛知県名古屋市');
a.click('form-save');
assert.equal(a.state().properties.find(x=>x.id===p.id).manufacturer,'ヘーベルハウス');
assert.equal(a.state().properties.find(x=>x.id===p.id).price,'4350');
assert.equal(a.state().properties.find(x=>x.id===p.id).address,'愛知県名古屋市');
a.click('property-detail');
assert.match(a.app.innerHTML,/打合せ/);
assert.match(a.app.innerHTML,/メーカー/);
a.click('detail-page','1');
assert.match(a.app.innerHTML,/打ち合わせを登録/);
a.click('meeting-add');
assert.match(a.app.innerHTML,/VISIT & MEETING/);
assert.match(a.app.innerHTML,/data-meeting-model="type"/);
a.input({meetingModel:'type'},'内見');
a.input({meetingModel:'at'},'2026-11-14T15:30');
a.input({meetingModel:'maker'},'ヘーベルハウス');
a.input({meetingModel:'memo'},'構造と保証を確認した');
a.click('meeting-save');
assert.equal(a.state().properties.find(x=>x.id===p.id).meetings.length,1);
assert.equal(a.state().properties.find(x=>x.id===p.id).meetings[0].type,'内見');
assert.equal(a.state().properties.find(x=>x.id===p.id).meetings[0].notes[0],'構造と保証を確認した');
assert.match(a.app.innerHTML,/2026\/11\/14 15:30/);
assert.match(a.app.innerHTML,/内見日時/);
a.click('meeting-edit');
a.input({meetingModel:'memo'},'次回は見積もりを依頼する');
a.click('meeting-save');
assert.equal(a.state().properties.find(x=>x.id===p.id).meetings[0].notes[0],'次回は見積もりを依頼する');
a.click('meeting-note-add');
assert.equal(a.state().properties.find(x=>x.id===p.id).meetings[0].notes.length,2);
a.click('detail-page','2');
assert.match(a.app.innerHTML,/よかった点/);
a.click('note-add');
assert.equal(a.state().properties.find(x=>x.id===p.id).notes.good.length,2);
a.click('overlay-close');
a.click('search');
a.input({filter:'query'},'no such property');
a.click('filter-apply');
assert.match(a.app.innerHTML,/該当する物件がありません/);
a.click('search');
a.click('filter-clear');
assert.match(a.app.innerHTML,/サンプル[ABC]/);
a.click('add-property');
assert.match(a.app.innerHTML,/まとめて保存/);
a.input({model:'name'},'新しく登録した物件');
a.input({model:'manufacturer'},'住友不動産');
a.input({model:'price'},'4600');
a.input({model:'layout'},'4LDK');
a.click('form-save');
assert.equal(a.state().properties.length,4);
assert.equal(a.state().properties.find(x=>x.name==='新しく登録した物件').manufacturer,'住友不動産');
assert.equal(a.state().properties.find(x=>x.name==='新しく登録した物件').layout,'4LDK');
const b=start();
assert.equal(b.state().properties.length,4);
assert.equal(b.state().scores[p.id][c.id].husband,2);
console.log('ほっぽさん premium UI, property CRUD, comparisons, meetings: PASS');
