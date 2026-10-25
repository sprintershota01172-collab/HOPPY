// Synthetic touch regression: left swipe reveals deletion, right swipe closes it.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const listeners={},store={};
let clock=0,ids=0;
class FakeDate extends Date{static now(){clock+=1400;return clock;}}
const app={
  innerHTML:'',contains:()=>true,querySelector:()=>null,querySelectorAll:()=>[],
  insertAdjacentHTML:()=>{},addEventListener:(type,fn)=>{(listeners[type]??=[]).push(fn);}
};
const context={
  document:{getElementById:()=>app},window:{matchMedia:()=>({matches:true}),crypto:{randomUUID:()=>String(++ids)},addEventListener:()=>{}},
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},
  navigator:{},location:{protocol:'http:',hostname:'test.invalid'},
  confirm:()=>true,setTimeout:()=>0,clearTimeout:()=>{},Date:FakeDate,
  crypto:{randomUUID:()=>String(++ids)},Intl,console,URL,Number,Math,Array,JSON,String,Promise
};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),context,{filename:'app.js'});
const click=(act,value='')=>{
  const btn={dataset:{act,value}};
  listeners.click[0]({target:{closest:()=>btn},preventDefault(){}});
};
const input=(prop,value)=>{
  listeners.input[0]({target:{dataset:prop,value,hasAttribute:()=>false}});
};
click('seed');
click('tab','memo');
click('study-add');
input({study:'title'},'削除テスト');
input({study:'text'},'断熱材について確認する。');
click('study-save');
const memo=JSON.parse(store['hoppy-phase1-v1']).studyNotes[0];
assert.ok(memo);
const memoKey='study~'+memo.id;
const touch=(action,x,y)=>{
  const element={dataset:{memoKey},closest:(selector)=>selector==='.memo-swipe-wrap'?element:null};
  const event={target:element,changedTouches:[{clientX:x,clientY:y}]};
  for(const fn of listeners[action])fn(event);
};
touch('touchstart',180,120);
touch('touchend',72,125);
assert.match(app.innerHTML,/memo-card swiped/,'left swipe reveals the delete action');
touch('touchstart',60,120);
touch('touchend',166,122);
assert.doesNotMatch(app.innerHTML,/memo-card swiped/,'right swipe closes delete action');
touch('touchstart',180,120);
touch('touchend',65,125);
click('memo-remove',memoKey);
assert.equal(JSON.parse(store['hoppy-phase1-v1']).studyNotes.length,0);
console.log('HOPPO touch swipe reveal/close/delete: PASS');
