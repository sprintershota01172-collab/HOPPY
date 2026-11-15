'use strict';
// 地価ランキング集計スクリプトの検証（API はモック。実データは使わない）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const load = () => import(path.join(__dirname, '..', 'scripts', 'fetch-landprice.mjs'));

test('価格・変動率の文字列を数値化する', async () => {
  const m = await load();
  assert.equal(m.parseYen('97,800(円/㎡)'), 97800);
  assert.equal(m.parseYen('97,800(円/m2)'), 97800);
  assert.equal(m.parseYen(''), null);
  assert.equal(m.parseRate('3.9'), 3.9);
  assert.equal(m.parseRate('△1.1'), -1.1);
  assert.equal(m.parseRate('-0.3%'), -0.3);
  assert.equal(m.parseRate(''), null);
  assert.equal(Math.round(m.sqmToTsubo(100000)), 330579);
});

test('中央値は上下5%を除外して計算する', async () => {
  const m = await load();
  const xs = Array.from({ length: 40 }, (_, i) => i + 1).concat([10000, 20000]);
  assert.equal(m.median([3, 1, 2]), 2);
  assert.equal(m.trimmedMedian(xs), m.median(xs.slice().sort((a, b) => a - b).slice(2, -2)));
});

test('タイル範囲は約800枚、多治見駅の距離計算', async () => {
  const m = await load();
  const tiles = m.tilesFor();
  assert.ok(tiles.length > 700 && tiles.length < 900, 'タイル数 ' + tiles.length);
  assert.ok(Math.abs(m.haversineKm({ lat: 35.334, lon: 137.121 }, { lat: 35.426, lon: 137.061 }) - 11.6) < 0.3);
});

test('市区町村を名前で照合し、名古屋市は区ごとに扱う', async () => {
  const m = await load();
  const aichi = m.pickTargets('23', [
    { id: '23100', name: '名古屋市' }, { id: '23101', name: '名古屋市千種区' }, { id: '23106', name: '中区' },
    { id: '23204', name: '瀬戸市' }, { id: '23302', name: '愛知郡東郷町' }, { id: '23999', name: '架空市' }
  ]);
  assert.deepEqual(aichi.map(c => [c.code, c.name, c.region]), [
    ['23101', '名古屋市千種区', '名古屋市'], ['23106', '名古屋市中区', '名古屋市'],
    ['23204', '瀬戸市', '尾張'], ['23302', '東郷町', '尾張']
  ]);
  const gifu = m.pickTargets('21', [{ id: '21204', name: '多治見市' }, { id: '21201', name: '岐阜市' }, { id: '21521', name: '可児郡御嵩町' }]);
  assert.deepEqual(gifu.map(c => c.region), ['東濃', '中濃']);
  const all = [...Object.values(m.AICHI_REGIONS).flat()];
  assert.equal(all.length + 1, 54, '愛知県は名古屋市＋53市町村');
});

/* ---------- 模擬APIでの通し実行 ---------- */

function fakeApi({ chosaLatest = 2026, kojiLatest = 2026, typeValues = ['0', '1'] } = {}) {
  const calls = [];
  const munis = {
    '23': [['23100', '名古屋市'], ['23106', '名古屋市中区'], ['23204', '瀬戸市'], ['23219', '小牧市']],
    '21': [['21201', '岐阜市'], ['21204', '多治見市'], ['21214', '可児市']]
  };
  // 都市ごとの地点（住宅地2・商業地1）。価格は毎年+2%。
  const cities = [
    ['23106', '23', 35.168, 136.906, 600000], ['23204', '23', 35.223, 137.084, 60000],
    ['23219', '23', 35.291, 136.912, 90000], ['21204', '21', 35.334, 137.121, 38000],
    ['21214', '21', 35.426, 137.061, 31000], ['21201', '21', 35.423, 136.761, 80000]
  ];
  const points = [];
  for (const [code, pref, lat, lon, base] of cities) {
    for (const kind of ['koji', 'chosa']) {
      [['住宅地', 1, 0], ['住宅地', 0.6, 0.004], ['商業地', 2.5, 0.008]].forEach(([use, factor, off], i) => {
        points.push({ code, pref, lat: lat + off + (kind === 'chosa' ? 0.002 : 0), lon: lon + off, base: base * factor * (kind === 'chosa' ? 0.95 : 1), use, kind, lot: code + '-' + kind + '-' + i });
      });
    }
  }
  const tileX = (lon) => Math.floor((lon + 180) / 360 * 8192);
  const tileY = (lat) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 8192); };
  const res = (status, body) => ({ status, text: async () => body == null ? '' : JSON.stringify(body) });
  const fetchImpl = async (url) => {
    const u = new URL(url), api = u.pathname.split('/').pop(), q = Object.fromEntries(u.searchParams);
    calls.push(api);
    if (api === 'XIT002') return res(200, { status: 'OK', data: munis[q.area].map(([id, name]) => ({ id, name })) });
    if (api === 'XPT002') {
      const year = +q.year, x = +q.x, y = +q.y;
      const kinds = q.priceClassification === '0' ? ['koji'] : q.priceClassification === '1' ? ['chosa'] : ['koji', 'chosa'];
      const features = points.filter(p => kinds.includes(p.kind) && tileX(p.lon) === x && tileY(p.lat) === y)
        .filter(p => year <= (p.kind === 'koji' ? kojiLatest : chosaLatest) && year >= 2010)
        .map(p => {
          const price = Math.round(p.base * 1.02 ** (year - 2016));
          return { type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {
            point_id: p.lot + year, land_price_type: p.kind === 'koji' ? typeValues[0] : typeValues[1],
            prefecture_code: p.pref, city_code: p.code, use_category_name_ja: p.use, standard_lot_number_ja: p.lot,
            location: '所在地 ' + p.lot, nearest_station_name_ja: p.code === '23106' ? '栄' : '駅' + p.code,
            u_current_years_price_ja: price.toLocaleString('en-US') + '(円/㎡)', last_years_price: Math.round(price / 1.02),
            year_on_year_change_rate: '2.0'
          } };
        });
      return res(200, { type: 'FeatureCollection', features });
    }
    if (api === 'XIT001') {
      const year = +q.year, quarter = +q.quarter;
      if (year * 4 + quarter > 2026 * 4 + 2) return res(200, { status: 'OK', data: [] });
      const rows = [];
      const codes = q.area === '23' ? ['23204', '23219'] : ['21204'];
      for (const code of codes) for (let i = 0; i < 4; i++) {
        rows.push({ PriceCategory: '不動産取引価格情報', Type: '宅地(土地)', MunicipalityCode: code, TradePrice: String(10000000 + i * 1000000), Area: '165', UnitPrice: '' });
        rows.push({ PriceCategory: '不動産取引価格情報', Type: '宅地(土地と建物)', MunicipalityCode: code, TradePrice: String(25000000 + i * 1000000), Area: '200' });
      }
      return res(200, { status: 'OK', data: rows });
    }
    return res(404, null);
  };
  return { fetchImpl, calls };
}

test('模擬APIで通し実行：集計・キャッシュ・変更なし判定', async () => {
  const m = await load();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landprice-'));
  const api = fakeApi();
  const now = new Date('2026-11-15T05:00:00Z');
  const quiet = () => {};
  const first = await m.run({ key: 'SECRET-KEY-123', dataDir: dir, fetchImpl: api.fetchImpl, now, gapMs: 0, logger: quiet });
  const out = first.out;
  assert.equal(first.changed, true);
  assert.equal(out.sources.koji.year, 2026);
  assert.equal(out.sources.chosa.year, 2026);
  assert.equal(out.sources.trade.latestPeriod, '2026Q2');
  assert.equal(out.sources.trade.period, '2025Q3-2026Q2');
  assert.deepEqual(out.cities.map(c => c.name).sort(), ['可児市', '名古屋市中区', '多治見市', '小牧市', '瀬戸市'].sort());
  assert.ok(!out.points.some(p => p.cityCode === '21201'), '岐阜市（対象外）は除外');
  const seto = out.cities.find(c => c.name === '瀬戸市');
  const k26 = Math.round(60000 * 1.02 ** 10), k26b = Math.round(36000 * 1.02 ** 10);
  assert.equal(seto.residential.koji.avgSqm, Math.round((k26 + k26b) / 2));
  assert.equal(seto.residential.koji.count, 2);
  assert.equal(seto.residential.koji.chg, 2);
  assert.ok(Math.abs(seto.residential.chg5y - (1.02 ** 5 - 1) * 100) < 0.05, 'chg5y ' + seto.residential.chg5y);
  assert.ok(Math.abs(seto.residential.chg10y - (1.02 ** 10 - 1) * 100) < 0.05, 'chg10y ' + seto.residential.chg10y);
  assert.equal(seto.residential.history.length, 11);
  assert.equal(seto.commercial.count, 2);
  assert.ok(seto.distFromTajimiKm > 10 && seto.distFromTajimiKm < 15);
  assert.equal(seto.trade.landCount, 16, '直近4四半期×4件');
  assert.equal(seto.trade.land8.count, 32);
  assert.equal(seto.trade.houseMedian, 26500000);
  const tajimi = out.cities.find(c => c.name === '多治見市');
  assert.ok(tajimi.distFromTajimiKm < 1.5);
  assert.ok(out.stations.some(s => s.name === '栄' && s.region === '名古屋市'));
  assert.ok(out.regions.find(r => r.id === 'tono').residential.count > 0);
  assert.ok(fs.existsSync(path.join(dir, 'tile-cache.json')));
  const cache = JSON.parse(fs.readFileSync(path.join(dir, 'tile-cache.json'), 'utf8'));
  assert.ok(cache.empty.length > 700, '空タイルを記録');
  assert.ok(fs.existsSync(path.join(dir, 'archive', 'xpt002-2016.json')));
  assert.ok(!JSON.stringify(out).includes('SECRET-KEY-123'), 'APIキーを出力しない');

  // 2回目：過去年はキャッシュ、空タイルはスキップ → XPT002 はほぼ呼ばない。内容が同じならファイルを書き換えない。
  const before = api.calls.length;
  const mtime = fs.statSync(path.join(dir, 'landprice.json')).mtimeMs;
  const second = await m.run({ key: 'SECRET-KEY-123', dataDir: dir, fetchImpl: api.fetchImpl, now: new Date('2026-11-16T05:00:00Z'), gapMs: 0, logger: quiet });
  const xpt = api.calls.slice(before).filter(a => a === 'XPT002').length;
  assert.ok(xpt <= 8, '2回目の XPT002 は最新年判定のみ: ' + xpt);
  assert.equal(second.changed, false);
  assert.equal(fs.statSync(path.join(dir, 'landprice.json')).mtimeMs, mtime);
});

test('地価調査が未公表の時期は前年を最新として扱う', async () => {
  const m = await load();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'landprice-'));
  const api = fakeApi({ chosaLatest: 2025, typeValues: ['地価公示', '都道府県地価調査'] });
  const { out } = await m.run({ key: 'k', dataDir: dir, fetchImpl: api.fetchImpl, now: new Date('2026-05-01T00:00:00Z'), gapMs: 0, logger: () => {} });
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
  assert.ok(seed.cities.every(c => c.code && c.region && c.residential && 'trade' in c));
});
