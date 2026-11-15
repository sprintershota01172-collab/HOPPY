// 国土数値情報「鉄道データ（N02）」から、愛知・岐阜周辺の駅と路線を集計して data/stations.json を作る（登録不要）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BBOX = { minLat: 34.55, maxLat: 35.95, minLon: 136.45, maxLon: 137.85 };
const YEARS = ['24', '23', '22', '21'];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function centroid(geom) {
  const pts = [];
  const add = c => { if (typeof c[0] === 'number') pts.push(c); else c.forEach(add); };
  add(geom.coordinates);
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length, lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [lat, lon];
}
const km = (a, b, c, d) => { const r = x => x * Math.PI / 180; const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

export function aggregate(features) {
  const lines = [], lineIdx = new Map(), stations = [];
  for (const f of features) {
    const p = f.properties || {};
    const line = String(p.N02_003 || '').trim(), op = String(p.N02_004 || '').trim(), name = String(p.N02_005 || '').trim();
    if (!line || !name || !f.geometry) continue;
    const [lat, lon] = centroid(f.geometry);
    if (lat < BBOX.minLat || lat > BBOX.maxLat || lon < BBOX.minLon || lon > BBOX.maxLon) continue;
    const key = op + '|' + line;
    if (!lineIdx.has(key)) { lineIdx.set(key, lines.length); lines.push({ name: line, op, n: 0 }); }
    const li = lineIdx.get(key);
    let s = stations.find(x => x.name === name && km(x.lat, x.lon, lat, lon) < 1.2);
    if (!s) { s = { name, lat, lon, lines: [] }; stations.push(s); }
    if (!s.lines.includes(li)) { s.lines.push(li); lines[li].n++; }
  }
  for (const s of stations) { s.lat = Math.round(s.lat * 1e5) / 1e5; s.lon = Math.round(s.lon * 1e5) / 1e5; }
  return { lines, stations };
}

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'n02-'));
  let used = null, features = null;
  for (const y of YEARS) {
    const url = `https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-${y}/N02-${y}_GML.zip`;
    try {
      const r = await fetch(url);
      if (!r.ok) { console.log('skip', url, r.status); continue; }
      const zip = path.join(work, `n02-${y}.zip`);
      fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
      const dir = path.join(work, y); fs.mkdirSync(dir);
      execFileSync('unzip', ['-o', '-qq', zip, '-d', dir], { stdio: 'ignore' });
      const files = walk(dir);
      console.log('files', files.map(f => path.relative(dir, f)).join(', '));
      const gj = files.find(f => /station/i.test(f) && /\.geojson$/i.test(f));
      if (!gj) { console.log('no station geojson in', url); continue; }
      features = JSON.parse(fs.readFileSync(gj, 'utf8')).features;
      used = url; break;
    } catch (e) { console.log('error', url, e.message); }
  }
  if (!features) { console.log('station data not found'); process.exitCode = 1; return; }
  const out = aggregate(features);
  out.source = '国土数値情報（鉄道データ）N02 ' + used;
  out.generatedAt = new Date().toISOString();
  console.log('lines', out.lines.length, 'stations', out.stations.length, 'sample', JSON.stringify(out.lines.slice(0, 8)));
  const file = path.resolve(here, '..', 'data', 'stations.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const same = prev && JSON.stringify({ ...prev, generatedAt: 0 }) === JSON.stringify({ ...out, generatedAt: 0 });
  if (!same) fs.writeFileSync(file, JSON.stringify(out));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${same ? 'false' : 'true'}\n`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
