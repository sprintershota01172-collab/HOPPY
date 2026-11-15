'use strict';
// 地価ランキング集計スクリプトの検証（国土数値情報の形式を模したデータ。通信はしない）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const load = () => import(path.join(__dirname, '..', 'scripts', 'fetch-landprice.mjs'));

test('価格・変動率の文字列を数値化する', async () => {
  const m = await load();
  assert.equal(m.parseYen('97,800(円/㎡)'), 97800);
  assert.equal(m.parseYen(''), null);
  assert.equal(m.parseRate('3.9'), 3.9);
  assert.equal(m.parseRate('△1.1'), -1.1);
  assert.equal(m.parseRate(''), null);
  assert.equal(Math.round(m.sqmToTsubo(100000)), 330579);
});

test('中央値は上下5%を除外、多治見駅の距離', async () => {
  const m = await load();
  const xs = Array.from({ length: 40 }, (_, i) => i + 1).concat([10000, 20000]);
  assert.equal(m.trimmedMedian(xs), m.median(xs.slice().sort((a, b) => a - b).slice(2, -2)));
  assert.ok(Math.abs(m.haversineKm({ lat: 35.334, lon: 137.121 }, { lat: 35.426, lon: 137.061 }) - 11.6) < 0.3);
});

test('対象は愛知県（名古屋市16区＋53市町村）と岐阜県7市町', async () => {
  const m = await load();
  const t = m.targetList();
  assert.equal(t.length, 16 + 53 + 7);
  assert.ok(t.every(x => x.region), '全市区町村に地域が付く');
  assert.equal(t.filter(x => x.region === '名古屋市').length, 16);
  assert.deepEqual([...new Set(t.filter(x => x.prefCode === '21').map(x => x.region))].sort(), ['中濃', '東濃']);
  const names = [...Object.values(m.AICHI_REGIONS).flat(), ...Object.values(m.GIFU_TARGETS).flat()];
  for (const n of names) assert.ok(t.some(x => x.name === n), n + ' のコードがある');
  assert.equal(m.ksjUrl('L01', 2026, '23'), 'https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-26/L01-26_23_GML.zip');
});

/* ---------- 国土数値情報（地価公示 2026年版 L01_001〜L01_148）を模したデータ ---------- */

const CITIES = [
  ['23106', '名古屋中', '名古屋市中区錦', '栄', 35.168, 136.906, 600000],
  ['23204', '瀬戸', '瀬戸市西茨町', '尾張瀬戸', 35.223, 137.084, 60000],
  ['23219', '小牧', '小牧市小牧', '小牧', 35.291, 136.912, 90000],
  ['21204', '多治見', '多治見市音羽町', '多治見', 35.334, 137.121, 38000],
  ['21214', '可児', '可児市広見', '西可児', 35.426, 137.061, 31000],
  ['21201', '岐阜', '岐阜市長住町', '岐阜', 35.423, 136.761, 80000]
];
const pad = n => String(n).padStart(3, '0');
// offset で列番号をずらし「年度・データセットごとに列番号が変わる」状況も再現する
function ksjFeatures({ prefix = 'L01', year = 2026, pref, offset = 0, firstYear = 1983, growth = 1.02 }) {
  const out = [];
  CITIES.filter(c => c[0].startsWith(pref)).forEach(([code, name, addr, station, lat, lon, base]) => {
    [['000', 1, 1], ['000', 0.6, 2], ['005', 2.5, 1]].forEach(([use, factor, seq], i) => {
      const k = n => prefix + '_' + pad(n + offset);
      const price = Math.round(base * factor * growth ** (year - 2016));
      const p = {};
      p[k(1)] = code; p[k(2)] = use; p[k(3)] = pad(seq); p[k(4)] = code; p[k(5)] = use; p[k(6)] = pad(seq);
      p[k(7)] = year; p[k(8)] = price; p[k(9)] = 2.0;
      for (let n = 10; n <= 23; n++) p[k(n)] = '0';
      p[k(24)] = name; p[k(25)] = addr + (i + 1) + '丁目' + (100 + i) + '番'; p[k(26)] = '_'; p[k(27)] = 165;
      p[k(28)] = ['住宅', '店舗,共同住宅'][i % 2]; p[k(31)] = 'W2';
      p[k(47)] = '中規模一般住宅が多い閑静な住宅地域'; p[k(48)] = station; p[k(49)] = '近接'; p[k(50)] = 800 + i * 100;
      p[k(51)] = '1中専'; p[k(53)] = '市街化';
      for (let y = firstYear; y <= year; y++) p[k(62 + (y - firstYear))] = y >= 2009 ? Math.round(base * factor * growth ** (y - 2016)) : 0;
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon + i * 0.004, lat + i * 0.004] }, properties: p });
    });
  });
  return out;
}

test('列番号が変わっても、中身から価格・変動率・推移・駅の列を判定する', async () => {
  const m = await load();
  const f = ksjFeatures({ pref: '23' });
  const s = m.detectSchema(f, { pref: '23', year: 2026 });
  assert.equal(s.cityKey, 'L01_001');
  assert.equal(s.useKey, 'L01_002');
  assert.equal(s.priceKey, 'L01_008');
  assert.equal(s.chgKey, 'L01_009');
  assert.equal(s.nameKey, 'L01_024');
  assert.equal(s.addressKey, 'L01_025');
  assert.equal(s.stationKey, 'L01_048');
  assert.deepEqual(s.history[0], [2026, 'L01_105']);
  assert.ok(s.history.some(([y, k]) => y === 2016 && k === 'L01_095'));
  const s2 = m.detectSchema(ksjFeatures({ prefix: 'L02', pref: '21', offset: -2 }), { pref: '21', year: 2026 });
  assert.equal(s2.priceKey, 'L02_006');
  assert.equal(s2.history[0][0], 2026);
  const pts = m.pointsFromFeatures(f, s, { kind: 'koji', year: 2026 });
  assert.equal(pts.length, 9);
  assert.equal(pts[0].lot, '名古屋中-1');
  assert.equal(pts[2].lot, '名古屋中5-1');
  assert.equal(pts[2].use, '商業地');
  assert.equal(pts[0].station, '栄');
  assert.ok(pts[0].hist[2021] > 0);
});

test('シェープファイル（.dbf/.shp）も読める', async () => {
  const m = await load();
  const fields = [['L01_001', 'C', 5], ['L01_008', 'N', 10], ['L01_024', 'C', 12]];
  const rows = [['21204', 97800, '多治見'], ['21204', 66400, '多治見']];
  const recLen = 1 + fields.reduce((a, f) => a + f[2], 0), headerLen = 32 + 32 * fields.length + 1;
  const dbf = Buffer.alloc(headerLen + recLen * rows.length + 1, 0);
  dbf[0] = 3; dbf.writeUInt32LE(rows.length, 4); dbf.writeUInt16LE(headerLen, 8); dbf.writeUInt16LE(recLen, 10);
  fields.forEach(([n, t, l], i) => { const o = 32 + i * 32; dbf.write(n, o, 'latin1'); dbf[o + 11] = t.charCodeAt(0); dbf[o + 16] = l; });
  dbf[headerLen - 1] = 0x0d;
  rows.forEach((r, i) => {
    let o = headerLen + i * recLen; dbf[o++] = 0x20;
    fields.forEach(([, , l], j) => { const b = Buffer.alloc(l, 0x20); Buffer.from(String(r[j]), 'utf8').copy(b); b.copy(dbf, o); o += l; });
  });
  const shp = Buffer.alloc(100 + rows.length * 28);
  rows.forEach((_, i) => { const o = 100 + i * 28; shp.writeInt32BE(i + 1, o); shp.writeInt32BE(10, o + 4); shp.writeInt32LE(1, o + 8); shp.writeDoubleLE(137.12 + i, o + 12); shp.writeDoubleLE(35.33, o + 20); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shp-'));
  fs.writeFileSync(path.join(dir, 'L01-26_21.dbf'), dbf);
  fs.writeFileSync(path.join(dir, 'L01-26_21.shp'), shp);
  fs.writeFileSync(path.join(dir, 'L01-26_21.cpg'), 'UTF-8');
  const f = m.readFeaturesFromDir(dir);
  assert.equal(f.length, 2);
  assert.equal(f[0].properties.L01_024, '多治見');
  assert.equal(f[1].properties.L01_008, 66400);
  assert.deepEqual(f[1].geometry.coordinates, [138.12, 35.33]);
});

function fakeKsj({ chosaLatest = 2026 } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    const mm = String(url).match(/\/(L0[12])-(\d\d)_(\d\d)_GML\.zip$/);
    if (!mm) return { status: 404, ok: false };
    const [, ds, yy, pref] = mm, year = 2000 + Number(yy);
    if (year > (ds === 'L01' ? 2026 : chosaLatest)) return { status: 404, ok: false };
    const features = ksjFeatures({ prefix: ds, year, pref, offset: ds === 'L02' ? -2 : 0, growth: ds === 'L02' ? 1.015 : 1.02 });
    const body = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }))]);
    return { status: 200, ok: true, arrayBuffer: async () => body };
  };
  const unzip = (zip, dir) => fs.writeFileSync(path.join(dir, 'data.geojson'), fs.readFileSync(zip).subarray(4));
  return { fetchImpl, unzip, calls };
}

test('通し実行：APIキーなしで集計し、同じ内容なら書き換えない', async () => {
  const m = await load();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landprice-'));
  const k = fakeKsj();
  const first = await m.run({ dataDir: dir, fetchImpl: k.fetchImpl, unzip: k.unzip, now: new Date('2026-11-15T05:00:00Z'), logger: () => {} });
  const out = first.out;
  assert.equal(first.changed, true);
  assert.equal(out.sources.koji.year, 2026);
  assert.equal(out.sources.chosa.year, 2026);
  assert.equal(out.tradeAvailable, false);
  assert.equal(out.sources.trade, null);
  assert.ok(k.calls.every(u => u.startsWith('https://nlftp.mlit.go.jp/')), 'APIは呼ばない');
  assert.equal(out.cities.length, 76);
  assert.ok(!out.points.some(p => p.cityCode === '21201'), '岐阜市は地点一覧に含めない');
  assert.equal(out.prefs.find(p => p.code === '21').residential.koji.count, 6, '県の平均は県内すべての地点');
  const seto = out.cities.find(c => c.name === '瀬戸市');
  const a = 60000 * 1.02 ** 10, b = 36000 * 1.02 ** 10;
  assert.equal(seto.residential.koji.avgSqm, Math.round((Math.round(a) + Math.round(b)) / 2));
  assert.equal(seto.residential.koji.count, 2);
  assert.equal(seto.residential.koji.chg, 2);
  assert.ok(Math.abs(seto.residential.chg10y - ((1.02 ** 10 - 1) * 100 + (1.015 ** 10 - 1) * 100) / 2) < 0.1, 'chg10y ' + seto.residential.chg10y);
  assert.equal(seto.residential.history.length, 11);
  assert.equal(seto.residential.history[0].year, 2016);
  assert.equal(seto.commercial.count, 2);
  assert.equal(seto.trade, null);
  assert.ok(seto.distFromTajimiKm > 10 && seto.distFromTajimiKm < 15);
  assert.ok(out.cities.find(c => c.name === '多治見市').distFromTajimiKm < 1.5);
  assert.ok(out.stations.some(s => s.name === '栄' && s.region === '名古屋市'));
  assert.ok(out.points.some(p => p.lot === '多治見-1'));
  assert.ok(out.points.find(p => p.lot === '多治見-1' && p.kind === 'koji').chg5y > 9);
  const mtime = fs.statSync(path.join(dir, 'landprice.json')).mtimeMs;
  const second = await m.run({ dataDir: dir, fetchImpl: k.fetchImpl, unzip: k.unzip, now: new Date('2026-11-16T05:00:00Z'), logger: () => {} });
  assert.equal(second.changed, false);
  assert.equal(fs.statSync(path.join(dir, 'landprice.json')).mtimeMs, mtime);
});

test('地価調査が未公開の時期は前年を最新として扱う', async () => {
  const m = await load();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landprice-'));
  const k = fakeKsj({ chosaLatest: 2025 });
  const { out } = await m.run({ dataDir: dir, fetchImpl: k.fetchImpl, unzip: k.unzip, now: new Date('2026-05-01T00:00:00Z'), logger: () => {} });
  assert.equal(out.sources.koji.year, 2026);
  assert.equal(out.sources.chosa.year, 2025);
  const kani = out.cities.find(c => c.name === '可児市');
  assert.equal(kani.residential.chosa.count, 2);
  assert.ok(kani.residential.history.some(h => h.year === 2026));
});

test('初期データ（seed）はアプリが読める形', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'landprice-seed.json'), 'utf8'));
  assert.equal(seed.seed, true);
  assert.equal(seed.prefs.find(p => p.code === '23').residential.koji.avgSqm, 132130);
  assert.equal(seed.cities.find(c => c.name === '多治見市').residential.koji.avgSqm, 38937);
  assert.equal(seed.points.length, 9);
});
