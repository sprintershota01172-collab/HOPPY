// Offline readiness contract: PWA shell + editor and organizer are bundled locally.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const sw=fs.readFileSync('sw.js','utf8');
const js=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
for(const name of ['index.html','styles.css','app.js','manifest.webmanifest','icon.svg','icon-192.png']){
  assert.match(sw,new RegExp(name.replace('.','\\.')));
}
assert.match(sw,/caches\.open\(CACHE\)/);
assert.match(sw,/cache\.addAll\(STATIC\)/);
assert.match(sw,/\.catch\(async \(\) => \{/);
assert.match(sw,/caches\.match\(/);
assert.match(js,/function organizeStudyText\(/);
assert.match(js,/function studyNormalizeLine\(/);
assert.match(js,/function studySummaryItems\(/);
assert.doesNotMatch(js.slice(js.indexOf('function studyNormalizeLine'),js.indexOf('function pendingScreen')),/fetch\(|XMLHttpRequest|WebSocket/);
assert.match(js,/serviceWorker\.register\('\.\/sw\.js'\)/);
assert.equal(manifest.display,'standalone');
console.log('Hoppo study organizer and offline PWA shell: PASS');
