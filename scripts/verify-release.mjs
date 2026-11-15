import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const read = path => fs.readFileSync(path, "utf8");
const release = JSON.parse(read("release.json"));
const version = release.version;
const index = read("index.html");
const entry = "visual-" + version + ".html";
const modern = read(entry);
const js = read("app.js");
const css = read("styles.css");
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
const refresh = read("refresh.html");

assert.equal(release.version, version, "The release marker is wrong");
assert.ok(js.includes("const BUILD = '" + version + "'"), "JavaScript build marker mismatch");
assert.match(js, /lp-screen/, "Land price screen not present");
assert.match(js, /landSimScreen/, "Cost simulator not present");
assert.match(css, /#app \.lp-views/, "Land price styles not present");
assert.match(css, /hoppo-version-banner/, "Version alert styles not present");
for (const [path, html] of [["index.html", index], [entry, modern]]) {
  assert.ok(html.includes("app.js?v=fp-20261028-" + version), path + ": JS reference not updated");
  assert.ok(html.includes("styles.css?v=fp-20261028-" + version), path + ": CSS reference not updated");
}
assert.ok(modern.includes('data-build="' + version + '"'), "Fresh entry has no version marker");
assert.ok(sw.includes("hopposan-static-" + version), "Service Worker is stale");
assert.ok(sw.includes("release.json"), "Release check cannot bypass Service Worker cache");
assert.ok(refresh.includes("const REPAIR_RELEASE = '" + version + "'"), "Recovery page checks the wrong version");
assert.ok(refresh.includes("location.replace('./index.html?fresh='"), "Recovery page must open a stable entrypoint");
assert.ok(!/id="repair"[^>]*disabled/.test(refresh), "Recovery button must work when version validation fails");
assert.ok(!/localStorage\.(clear|removeItem)|indexedDB\.deleteDatabase/.test(refresh), "Recovery may not erase household data");
assert.equal(manifest.start_url, "./index.html", "PWA start_url must be stable across releases");
assert.equal(manifest.id, "./index.html", "PWA identity must not change on subsequent releases");
const olderEntrypoints = fs.readdirSync(".").filter(x => /^(?:fp|visual)-r\d+\.html$/.test(x) && x !== entry);
assert.ok(olderEntrypoints.includes("visual-r64.html"), "Pinned r64 launcher not present");
for (const path of olderEntrypoints) {
  const text = read(path);
  assert.ok(text.includes('data-hoppy-legacy-launcher="1"'), path + ": legacy entry does not redirect");
  assert.ok(text.includes("location.replace('./index.html'"), path + ": legacy entry does not target stable index");
  assert.ok(!text.includes("app.js?v="), path + ": pinned versioned JS would prevent updates");
}
new Function(js);
new Function(sw);

function smoke(existing, key = "chika-shirabe-v1") {
  const handlers = {};
  const app = {
    markup: "",
    get innerHTML() { return this.markup; },
    set innerHTML(value) { this.markup = value; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) { handlers[type] = fn; },
    insertAdjacentHTML() {},
    contains() { return true; }
  };
  const saved = existing ? { [key]: JSON.stringify(existing) } : {};
  const storage = {
    getItem(key) { return saved[key] ?? null; },
    setItem(key, value) { saved[key] = value; }
  };
  const document = {
    getElementById(id) { return id === "app" ? app : null; },
    addEventListener() {},
    hidden: false
  };
  const window = { matchMedia() { return { matches: false }; }, addEventListener() {} };
  const navigator = {};
  const location = { protocol: "file:", hostname: "local-fixture" };
  const context = { document, window, navigator, location, localStorage: storage, setTimeout: () => 0, clearTimeout: () => {} };
  vm.runInNewContext(js, context, { timeout: 5000 });
  assert.match(app.markup, /lp-screen/, "Land price screen did not render");
  assert.match(app.markup, /地価調べ君/, "App name is not shown");
  return { saved, app, handlers };
}

const initial = smoke(null);
assert.ok(initial.saved["chika-shirabe-v1"], "Settings were not saved");
// 旧データ（家探しノート）からは地価の設定だけ引き継ぐ
const legacy = smoke({ version: 2, properties: [], criteria: [], land: { view: "maker", wishTsubo: 60 } }, "hoppy-phase1-v1");
const migrated = JSON.parse(legacy.saved["chika-shirabe-v1"]);
assert.equal(migrated.land.view, "maker");
assert.equal(migrated.land.wishTsubo, 60);
assert.ok(legacy.saved["hoppy-phase1-v1"], "Legacy data must not be erased");
// 保存データが起動のたびに消えないこと（r100で修正した不具合の再発防止）
const kept = smoke({ version: 1, land: { filter: "nagoya", favorites: ["23204"], favTowns: ["23204|陶原町"], money: { income: 650, own: 300 },
  my: [{ id: "a1", city: "23204", tsubo: 40, price: 1000, station: "尾張瀬戸", walk: 8 }],
  commute: { people: [{ name: "名古屋駅", lat: 35.17, lon: 136.88, mode: "car" }, {}] }, size: { people: 5, cars: 1 } } }, "chika-shirabe-v1");
const keptState = JSON.parse(kept.saved["chika-shirabe-v1"]).land;
assert.equal(keptState.filter, "nagoya", "Saved area filter was reset");
assert.deepEqual(keptState.favorites, ["23204"], "Saved favorites were reset");
assert.equal(keptState.my.length, 1, "Registered lands were erased");
assert.equal(keptState.money.income, 650, "Money settings were reset");
assert.equal(keptState.commute.people[0].name, "名古屋駅", "Commute settings were reset");
assert.equal(keptState.size.people, 5, "Size settings were reset");
const button = { dataset: { act: "lp-view", value: "sim" } };
initial.handlers.click({ target: { closest() { return button; } }, preventDefault() {} });
console.log("PASS: build, cache, manifest, entrypoints, land screen and settings migration", version);
