// Regression: opening/turning full-screen pages never remounts the home screen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const css = fs.readFileSync('styles.css','utf8');
const html = fs.readFileSync('index.html','utf8');
assert.match(css,/\.full\{\s*animation:none\s*!important;\s*opacity:1\s*!important/);
assert.match(css,/@keyframes hoppo-subtle-enter/);
assert.doesNotMatch(html,/location\.reload\(\)/);
let markup = '';
let writes = 0, insertions = 0, replacements = 0, overlayExists = false;
const callbacks = {};
const app = {
  get innerHTML(){return markup;},
  set innerHTML(v){markup=v;writes++;overlayExists=markup.includes('class="full"');},
  addEventListener(k,fn){callbacks[k]=fn;},
  contains(){return true;},
  querySelectorAll(){return [];},
  querySelector(selector){
    if(selector==='main.main' && markup.includes('<main class="main">'))return {};
    if(selector==='header.top' && markup.includes('<header class="top'))return {};
    if(selector==='nav.bottom' && markup.includes('<nav class="bottom"'))return {
      querySelector(q){return q.includes('data-value="property"')&&markup.includes('class="tab active" data-act="tab" data-value="property"')?{}:null;}
    };
    if(selector==='.full'&&overlayExists)return {
      set outerHTML(v){replacements++;overlayExists=v.includes('class="full"');}
    };
    return null;
  },
  insertAdjacentHTML(_position,html){
    if(html.includes('class="full"')){overlayExists=true;insertions++;}
  }
};
const memory={};let seq=0,now=0;
class FakeDate extends Date{static now(){now+=1500;return now;}}
const win={matchMedia:()=>({matches:true}),crypto:{randomUUID:()=>String(++seq)},addEventListener(){}};
const ctx={
 document:{getElementById:()=>app},window:win,
 localStorage:{getItem:k=>memory[k]||null,setItem:(k,v)=>memory[k]=v},
 navigator:{},location:{protocol:'http:',hostname:'example.com'},
 confirm:()=>true,setTimeout:()=>0,clearTimeout(){},Date:FakeDate,crypto:win.crypto,
 Intl,console,URL,Number,Math,Array,JSON,String,Promise
};
vm.runInNewContext(fs.readFileSync('app.js','utf8'),ctx,{filename:'app.js'});
const click=(act,value='')=>callbacks.click({target:{closest:()=>({dataset:{act,value}})},preventDefault(){}});
assert.equal(writes,1,'first render builds the shell');
click('seed');
assert.equal(writes,2,'changing home data updates the shell');
const p=JSON.parse(memory['hoppy-phase1-v1']).properties[0];
click('home-open',p.id);
assert.equal(writes,2,'opening details must not remount the underlying home');
assert.equal(insertions,1,'details are placed over the existing home');
click('detail-page','1');
assert.equal(writes,2,'moving to a detail page must not remount the home');
assert.ok(replacements>=1,'existing overlay is replaced in place');
click('detail-page','2');
assert.equal(writes,2);
click('detail-close');
assert.equal(writes,3,'closing details refreshes the underlying home');
click('settings');
assert.equal(writes,3,'opening settings does not remount the home');
console.log('HOPPO no-flash shell, opaque overlay, and PWA navigation tests: PASS');
