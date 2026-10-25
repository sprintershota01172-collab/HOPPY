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
assert.doesNotMatch(a.app.innerHTML,/data-act="rater"/);
const [p]=a.state().properties;
const [c]=a.state().criteria;
a.click('rating','',{property:p.id,criterion:c.id});
assert.match(a.app.innerHTML,/よい（2点）/);
a.click('score-set','2');
assert.equal(a.state().scores[p.id][c.id].overall,2);
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
assert.equal(b.state().scores[p.id][c.id].overall,2);

// Guided financial simulator: five questions, automatic results, persisted answers.
a.click('tab','sim');
assert.match(a.app.innerHTML,/ご家族のこれから/);
a.input({sim:'husbandAge'},28);
a.input({sim:'children'},2);
assert.equal(a.state().plan.husbandAge,28);
for(let i=0;i<3;i++)a.click('sim-next');
assert.match(a.app.innerHTML,/購入したい住まい/);
a.input({sim:'propertyId'},p.id);
assert.equal(a.state().plan.propertyPrice,4350);
a.click('sim-next');
assert.match(a.app.innerHTML,/これからの大きな支出/);
a.input({sim:'weddingCost'},360);
a.click('sim-next');
assert.match(a.app.innerHTML,/将来の現金貯金/);
assert.match(a.app.innerHTML,/sim-chart/);
a.click('sim-result-page','1');
assert.match(a.app.innerHTML,/月々ローン返済/);
a.click('sim-result-page','1');
assert.match(a.app.innerHTML,/教育費の積立目標/);
a.click('sim-restart');
assert.match(a.app.innerHTML,/ご家族のこれから/);

// Memo tab: linked and global notes, editing, summarization and deletion.
a.click('tab','memo');
assert.match(a.app.innerHTML,/memo-scope-switch/);
assert.match(a.app.innerHTML,/個別のメモ/);
assert.match(a.app.innerHTML,/すべてのメモ/);
assert.doesNotMatch(a.app.innerHTML,/data-act="study-toggle"/);
a.input({memoProperty:''},p.id);
a.click('study-add');
assert.match(a.app.innerHTML,/修正・整理する/);
assert.match(a.app.innerHTML,/data-study="propertyId"/);
a.input({study:'propertyId'},p.id);
a.input({study:'title'},'モデルハウスでの学び');
a.input({study:'text'},'金利が上がるとローン負担が増える。耐震構造を確認する必要がある。シュミレーション の金額を確認したい');
a.click('study-fix');
assert.match(a.app.innerHTML,/自動修正しました/);
assert.match(a.app.innerHTML,/◈ お金・住宅ローン/);
assert.match(a.app.innerHTML,/シミュレーション/);
assert.match(a.app.innerHTML,/□ シミュレーションの金額を確認したい/);
a.click('study-undo');
assert.doesNotMatch(a.app.innerHTML,/自動修正しました/);
a.click('study-fix');
a.click('study-save');
assert.equal(a.state().studyNotes.length,1);
assert.equal(a.state().studyNotes[0].propertyId,p.id);
assert.match(a.state().studyNotes[0].originalText,/シュミレーション/);
assert.match(a.app.innerHTML,/モデルハウスでの学び/);
assert.match(a.app.innerHTML,/memo-swipe-wrap/);
assert.match(a.app.innerHTML,/data-act="memo-remove"/);
a.click('study-summarize');
assert.match(a.app.innerHTML,/メモをすっきり整理/);
assert.match(a.app.innerHTML,/金利が上がるとローン負担が増える/);
a.click('study-digest-back');
assert.match(a.app.innerHTML,/モデルハウスでの学び/);
const id=a.state().studyNotes[0].id;
a.click('memo-open','study~'+id);
assert.match(a.app.innerHTML,/メモを編集/);
a.input({study:'text'},'断熱性能と耐震性を確認した。');
a.click('study-save');
assert.match(a.state().studyNotes[0].text,/断熱性能と耐震性/);
a.click('memo-scope','all');
assert.match(a.app.innerHTML,/すべてのメモ/);
// A memo in general scope is intentionally not attached to any property.
a.click('study-add');
a.input({study:'title'},'共有メモ');
a.input({study:'text'},'建物の費用を比較する。');
a.click('study-save');
assert.equal(a.state().studyNotes.length,2);
assert.equal(a.state().studyNotes[0].propertyId,'');
a.click('memo-scope','individual');
assert.match(a.app.innerHTML,/モデルハウスでの学び/);
assert.doesNotMatch(a.app.innerHTML,/共有メモ/);
a.click('memo-scope','all');
assert.match(a.app.innerHTML,/共有メモ/);
a.click('memo-remove','study~'+id);
assert.equal(a.state().studyNotes.length,1);
const b2=start();
assert.equal(b2.state().plan.husbandAge,28);
assert.equal(b2.state().plan.weddingCost,360);
assert.equal(b2.state().studyNotes.length,1);
assert.equal(b2.state().properties.length,4);
console.log('ほっぽさん premium UI + simulator + local learning organizer: PASS');
