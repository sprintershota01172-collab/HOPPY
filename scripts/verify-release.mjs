import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const version = "r63";
const read = path => fs.readFileSync(path, "utf8");
const release = JSON.parse(read("release.json"));
const index = read("index.html");
const modern = read("visual-r63.html");
const js = read("app.js");
const css = read("styles.css");
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));
const refresh = read("refresh.html");

assert.equal(release.version, version, "The release marker is wrong");
assert.match(js, /const BUILD = 'r63'/, "JavaScript build marker mismatch");
assert.match(js, /home-visual-header/, "Visual homepage not present");
assert.match(js, /fp-meta-dashboard/, "Visual FP dashboard not present");
assert.match(css, /home-visual-screen/, "Visual homepage styles not present");
assert.match(css, /hoppo-version-banner/, "Version alert styles not present");
for (const [path, html] of [["index.html", index], ["visual-r63.html", modern]]) {
  assert.ok(html.includes("app.js?v=fp-20261028-r63"), path + ": JS reference not updated");
  assert.ok(html.includes("styles.css?v=fp-20261028-r63"), path + ": CSS reference not updated");
}
assert.ok(modern.includes('data-build="r63"'), "Fresh entry has no version marker");
assert.ok(sw.includes("hopposan-static-r63"), "Service Worker is stale");
assert.ok(sw.includes("release.json"), "Release check cannot bypass Service Worker cache");
assert.ok(refresh.includes("const BUILD = 'r63'"), "Recovery page checks the wrong version");
assert.ok(refresh.includes("visual-r63.html"), "Recovery page opens an old entrypoint");
assert.equal(manifest.start_url, "./visual-r63.html", "PWA start_url is not current");
new Function(js);
new Function(sw);

function smoke(existing) {
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
  const saved = existing ? { "hoppy-phase1-v1": JSON.stringify(existing) } : {};
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
  assert.match(app.markup, /home-visual-header/, "Homepage did not render");
  assert.match(app.markup, /r63/, "Visible version is not current");
  return { saved, app, handlers };
}

const initial = smoke(null);
const state = JSON.parse(initial.saved["hoppy-phase1-v1"]);
state.plan.hasRun = 1;
state.plan.foodMonthly = 3;
state.plan.electricityMonthly = 1;
state.plan.gasMonthly = 0.5;
const populated = smoke(state);
const button = { dataset: { act: "tab", value: "sim" } };
populated.handlers.click({ target: { closest() { return button; } }, preventDefault() {} });
assert.match(populated.app.markup, /fp-meta-dashboard/, "FP summary did not render");
assert.match(populated.app.markup, /fp-result-nav/, "FP icon tabs did not render");
console.log("PASS: build, cache, manifest, entrypoints, initial screen and FP render", version);
