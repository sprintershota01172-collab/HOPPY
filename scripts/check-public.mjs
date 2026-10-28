import assert from "node:assert/strict";

const base = process.argv[2]?.replace(/\/+$/, "");
const expectedVersion = process.argv[3];
const expectedSha = process.argv[4];
assert.ok(base?.startsWith("https://"), "Pages deployment URL is not HTTPS");
assert.match(expectedVersion, /^r[0-9]+$/);
assert.match(expectedSha, /^[a-f0-9]{40}$/);

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let last = "not checked";
for (let attempt = 1; attempt <= 36; attempt++) {
  try {
    const now = Date.now();
    const jsonResponse = await fetch(base + "/release.json?verified=" + now, { cache: "no-store", signal: AbortSignal.timeout(16000) });
    if (!jsonResponse.ok) throw Error("release.json HTTP " + jsonResponse.status);
    const release = await jsonResponse.json();
    if (release.version !== expectedVersion) throw Error("version " + release.version + " != " + expectedVersion);
    if (release.commit !== expectedSha) throw Error("published commit " + release.commit + " != " + expectedSha);
    const htmlResponse = await fetch(base + "/visual-" + expectedVersion + ".html?verified=" + now, { cache: "no-store", signal: AbortSignal.timeout(16000) });
    if (!htmlResponse.ok) throw Error("entrypoint HTTP " + htmlResponse.status);
    const html = await htmlResponse.text();
    if (!html.includes('data-build="' + expectedVersion + '"')) throw Error("entrypoint build marker mismatch");
    const jsResponse = await fetch(base + "/app.js?verified=" + now, { cache: "no-store", signal: AbortSignal.timeout(16000) });
    if (!jsResponse.ok) throw Error("app.js HTTP " + jsResponse.status);
    const js = await jsResponse.text();
    if (!js.includes("const BUILD = '" + expectedVersion + "'")) throw Error("JavaScript build marker mismatch");
    if (!js.includes("home-visual-header") || !js.includes("fp-loan-focus")) throw Error("FP UI missing");
    const cssResponse = await fetch(base + "/styles.css?verified=" + now, { cache: "no-store", signal: AbortSignal.timeout(16000) });
    if (!cssResponse.ok) throw Error("styles.css HTTP " + cssResponse.status);
    const css = await cssResponse.text();
    if (!css.includes("/* " + expectedVersion + ": natural height")) throw Error("New stylesheet missing");
    const indexResponse = await fetch(base + "/index.html?verified=" + now, {cache:"no-store", signal:AbortSignal.timeout(16000)});
    if (!indexResponse.ok) throw Error("index.html HTTP " + indexResponse.status);
    const index = await indexResponse.text();
    if (!index.includes("app.js?v=fp-20261028-" + expectedVersion) || !index.includes("styles.css?v=fp-20261028-" + expectedVersion)) throw Error("HTML does not reference new JS+CSS");
    const swResponse = await fetch(base + "/sw.js?verified=" + now, {cache:"no-store", signal:AbortSignal.timeout(16000)});
    if (!swResponse.ok || !(await swResponse.text()).includes("hopposan-static-" + expectedVersion)) throw Error("Service Worker version mismatch");
    const manifestResponse = await fetch(base + "/manifest.webmanifest?verified=" + now, {cache:"no-store", signal:AbortSignal.timeout(16000)});
    if (!manifestResponse.ok || (await manifestResponse.json()).start_url !== "./index.html") throw Error("PWA start URL mismatch");
    for (const old of ["visual-r64.html", "visual-r67.html", "fp-r60.html"]) {
      const oldRes=await fetch(base + "/" + old + "?verified=" + now,{cache:"no-store",signal:AbortSignal.timeout(16000)});
      if(!oldRes.ok)throw Error("legacy launcher HTTP " + oldRes.status + " (" + old + ")");
      const oldHtml=await oldRes.text();
      if(!oldHtml.includes('data-hoppy-legacy-launcher="1"') || !oldHtml.includes("location.replace('./index.html'"))
        throw Error("legacy pinned startup was not upgraded (" + old + ")");
    }
    const recoveryResponse=await fetch(base + "/refresh.html?verified=" + now,{cache:"no-store",signal:AbortSignal.timeout(16000)});
    if(!recoveryResponse.ok)throw Error("recovery endpoint HTTP "+recoveryResponse.status);
    const recovery=await recoveryResponse.text();
    if(!recovery.includes("const REPAIR_RELEASE = '"+expectedVersion+"'") || !recovery.includes('id="repair" type="button"'))
      throw Error("One-tap repair endpoint is unavailable or stale");
    console.log("LIVE VERIFIED (HTML, JS, CSS, SW, PWA, legacy launchers, one-tap recovery):", expectedVersion, expectedSha, base);
    process.exit(0);
  } catch (error) {
    last = String(error.message || error);
    console.log("Deployment not yet verified (" + attempt + "/36): " + last);
  }
  if (attempt < 36) await delay(10000);
}
console.error("DEPLOYMENT FAILED: site does not serve the expected code. Last error: " + last);
process.exit(1);
