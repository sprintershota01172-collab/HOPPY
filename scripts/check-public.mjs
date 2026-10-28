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
    if (!js.includes("home-visual-header")) throw Error("new visual design missing");
    console.log("LIVE VERIFIED:", expectedVersion, expectedSha, base);
    process.exit(0);
  } catch (error) {
    last = String(error.message || error);
    console.log("Deployment not yet verified (" + attempt + "/36): " + last);
  }
  if (attempt < 36) await delay(10000);
}
console.error("DEPLOYMENT FAILED: site does not serve the expected code. Last error: " + last);
process.exit(1);
