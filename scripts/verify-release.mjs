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
assert.match(js, /home-visual-header/, "Visual homepage not present");
assert.match(js, /fp-meta-dashboard/, "Visual FP dashboard not present");
assert.match(css, /home-visual-screen/, "Visual homepage styles not present");
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
  assert.ok(app.markup.includes(version), "Visible version is not current");
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
