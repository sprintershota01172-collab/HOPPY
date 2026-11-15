#!/usr/bin/env node
// ほっぴーくん 地価ランキング集計スクリプト（Node 20 以上）
//
//   REINFOLIB_API_KEY=xxxx node scripts/fetch-landprice.mjs          # 通常（差分だけ取得）
//   REINFOLIB_API_KEY=xxxx node scripts/fetch-landprice.mjs --full   # 全タイル再走査
//
// データ: 国土交通省「不動産情報ライブラリ」API
//   XIT002 市区町村一覧 / XPT002 地価公示・地価調査ポイント / XIT001 取引価格
// 出力:   data/landprice.json（アプリが読む集計結果）
// キャッシュ（Pagesには配信しない）:
//   data/tile-cache.json          … 対象地点が無いタイル（海・山林・対象外）の一覧
//   data/archive/xpt002-YYYY.json … 年ごとの地点（過去年の公表値は変わらないため再取得しない）
//
// APIキーは環境変数からのみ読み、ファイル・ログ・出力JSONには書き出さない。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_BASE = 'https://www.reinfolib.mlit.go.jp/ex-api/external/';
export const TSUBO = 3.305785;
export const TAJIMI = { lat: 35.334, lon: 137.121 };
export const BBOX = { south: 34.55, north: 35.60, west: 136.65, east: 137.85 };
export const ZOOM = 13;
export const RESIDENTIAL = '住宅地';
export const COMMERCIAL = '商業地';
// 00=住宅地, 05=商業地, 10=市街化調整区域内の現況宅地（検算用に取得。平均には含めない）
export const USE_CODES = '00,05,10';

export const AICHI_REGIONS = {
  尾張: ['一宮市', '瀬戸市', '春日井市', '津島市', '犬山市', '江南市', '小牧市', '稲沢市', '尾張旭市', '岩倉市',
    '豊明市', '日進市', '愛西市', '清須市', '北名古屋市', '弥富市', 'あま市', '長久手市',
    '東郷町', '豊山町', '大口町', '扶桑町', '大治町', '蟹江町', '飛島村'],
  知多: ['半田市', '常滑市', '東海市', '大府市', '知多市', '阿久比町', '東浦町', '南知多町', '美浜町', '武豊町'],
  西三河: ['岡崎市', '碧南市', '刈谷市', '豊田市', '安城市', '西尾市', '知立市', '高浜市', 'みよし市', '幸田町'],
  東三河: ['豊橋市', '豊川市', '蒲郡市', '新城市', '田原市', '設楽町', '東栄町', '豊根村']
};
export const GIFU_TARGETS = {
  東濃: ['多治見市', '土岐市', '瑞浪市', '恵那市'],
  中濃: ['可児市', '御嵩町', '美濃加茂市']
};
export const REGION_ORDER = ['名古屋市', '尾張', '知多', '西三河', '東三河', '東濃', '中濃'];
export const REGION_IDS = { 名古屋市: 'nagoya', 尾張: 'owari', 知多: 'chita', 西三河: 'nishimikawa', 東三河: 'higashimikawa', 東濃: 'tono', 中濃: 'chuno' };
export const PREFS = { '23': '愛知県', '21': '岐阜県' };

// 7章の検算値（住宅地の平均 円/㎡）。集計結果と±5%以上ずれたらログに警告を出す。
export const EXPECTED = [
  { scope: 'pref', code: '23', kind: 'koji', year: 2026, avgSqm: 132130, chg: 1.79, label: '愛知県 2026年 地価公示' },
  { scope: 'pref', code: '23', kind: 'chosa', year: 2026, avgSqm: 122706, chg: 1.32, label: '愛知県 2026年 地価調査' },
  { scope: 'pref', code: '21', kind: 'koji', year: 2026, avgSqm: 46640, chg: -0.22, label: '岐阜県 2026年 地価公示', partial: true },
  { scope: 'pref', code: '21', kind: 'chosa', year: 2026, avgSqm: 33337, chg: -0.73, label: '岐阜県 2026年 地価調査', partial: true },
  { scope: 'city', name: '多治見市', kind: 'koji', year: 2026, avgSqm: 38937, chg: 0.32, label: '多治見市 2026年 地価公示' },
  { scope: 'city', name: '多治見市', kind: 'chosa', year: 2026, avgSqm: 36461, chg: -0.09, label: '多治見市 2026年 地価調査' },
  { scope: 'city', name: '可児市', kind: 'koji', year: 2026, avgSqm: 31600, chg: -0.27, label: '可児市 2026年 地価公示' },
  { scope: 'city', name: '小牧市', kind: 'koji', year: 2026, avgSqm: 92195, chg: 1.90, label: '小牧市 2026年 地価公示' },
  { scope: 'city', name: '春日井市', kind: 'chosa', year: 2025, avgSqm: 118381, chg: 2.67, label: '春日井市 2025年 地価調査' },
  { scope: 'city', name: '瀬戸市', kind: 'chosa', year: 2025, avgSqm: 60678, chg: 1.06, label: '瀬戸市 2025年 地価調査' }
];

/* ---------- 小さな純関数（tests/landprice.test.cjs で検証） ---------- */

// 「97,800(円/㎡)」「97800」「97,800円」→ 97800。数字が無ければ null。
export function parseYen(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = String(value).replace(/[,，\s]/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
// 「3.9」「-1.1」「△1.1」「▲0.3%」→ 数値（%）。空なら null。
export function parseRate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  if (!/\d/.test(s)) return null;
  const neg = /^[△▲\-−ー]/.test(s);
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}
export const sqmToTsubo = v => v * TSUBO;
export function mean(xs) {
  const v = xs.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export function median(xs) {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
// 上下 trim（既定5%）を除いた中央値
export function trimmedMedian(xs, trim = 0.05) {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  const cut = Math.floor(v.length * trim);
  return median(v.slice(cut, v.length - cut));
}
export const round1 = v => v == null ? null : Math.round(v * 10) / 10;
export const round2 = v => v == null ? null : Math.round(v * 100) / 100;
export const roundInt = v => v == null ? null : Math.round(v);
export function haversineKm(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
export function lat2y(lat, z) {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
}
export function tilesFor(b = BBOX, z = ZOOM) {
  const out = [];
  for (let x = lon2x(b.west, z); x <= lon2x(b.east, z); x++)
    for (let y = lat2y(b.north, z); y <= lat2y(b.south, z); y++) out.push(x + '/' + y);
  return out;
}
export function cleanName(name) {
  // 「可児郡御嵩町」→「御嵩町」。政令市の区は「名古屋市中区」の形にそろえる。
  return String(name || '').replace(/^.+?郡(?=.+[町村]$)/, '').trim();
}
export function regionOf(prefCode, code, name) {
  const n = cleanName(name);
  if (prefCode === '23') {
    if (/^231\d\d$/.test(code) && code !== '23100') return '名古屋市';
    for (const [region, list] of Object.entries(AICHI_REGIONS)) if (list.includes(n)) return region;
    return null;
  }
  if (prefCode === '21') {
    for (const [region, list] of Object.entries(GIFU_TARGETS)) if (list.includes(n)) return region;
  }
  return null;
}
// XIT002 の一覧から対象市区町村を確定（コードはハードコードせず名前で照合）
export function pickTargets(prefCode, list) {
  const rows = (list || []).map(x => ({ code: String(x.id ?? x.code ?? ''), name: String(x.name ?? '') }));
  const hasWards = rows.some(r => /^231\d\d$/.test(r.code) && r.code !== '23100');
  return rows.map(r => {
    if (prefCode === '23' && r.code === '23100' && hasWards) return null; // 名古屋市全体は区で扱う
    const region = regionOf(prefCode, r.code, r.name);
    if (!region) return null;
    let name = cleanName(r.name);
    if (region === '名古屋市' && !name.startsWith('名古屋市')) name = '名古屋市' + name;
    return { code: r.code, name, pref: PREFS[prefCode], prefCode, region };
  }).filter(Boolean);
}
// 地価区分（地価公示=koji / 地価調査=chosa）
export function kindFromType(value, mapping) {
  const s = String(value ?? '').trim();
  if (mapping && mapping[s]) return mapping[s];
  if (/公示/.test(s)) return 'koji';
  if (/調査|基準/.test(s)) return 'chosa';
  return null;
}
export function useOf(name) {
  const s = String(name || '');
  if (/商業/.test(s)) return COMMERCIAL;
  if (/調整/.test(s)) return '調整区域内宅地';
  if (/見込/.test(s)) return '宅地見込地';
  if (/住宅/.test(s)) return RESIDENTIAL;
  return s || 'その他';
}
export function normalizePoint(feature, kind, year) {
  const p = feature?.properties || {};
  const c = feature?.geometry?.coordinates || [];
  const price = parseYen(p.u_current_years_price_ja);
  if (!price || !kind) return null;
  const lot = String(p.standard_lot_number_ja || '').trim();
  const address = String(p.location || p.residence_display_name_ja || p.place_name_ja || '').trim();
  const pref = String(p.prefecture_code || '').padStart(2, '0');
  return {
    key: kind + '|' + pref + '|' + (lot || address),
    kind, year, lot, pref,
    cityCode: String(p.city_code || ''),
    use: useOf(p.use_category_name_ja),
    address,
    station: String(p.nearest_station_name_ja || '').trim(),
    priceSqm: price,
    chg: parseRate(p.year_on_year_change_rate),
    lat: Number.isFinite(+c[1]) ? Math.round(c[1] * 1e5) / 1e5 : null,
    lon: Number.isFinite(+c[0]) ? Math.round(c[0] * 1e5) / 1e5 : null
  };
}
// 同じ地点の重複を地点番号（無ければ所在地＋区分＋年）で除去
export function dedupe(points) {
  const map = new Map();
  for (const p of points) if (p && !map.has(p.key + '|' + p.year)) map.set(p.key + '|' + p.year, p);
  return [...map.values()];
}
// 価格の統計（平均・中央値・件数・継続地点の変動率平均＝公式と同じ算出）
export function priceStats(points) {
  const prices = points.map(p => p.priceSqm);
  const rates = points.map(p => p.chg).filter(Number.isFinite);
  return {
    avgSqm: roundInt(mean(prices)),
    medianSqm: roundInt(median(prices)),
    count: prices.length,
    chg: rates.length ? round2(mean(rates)) : null
  };
}
// 過去年の同じ地点と比べた上昇率（地点番号が同じでも300m以上動いたら入れ替わりとみなす）
export function continuingChange(nowPoints, pastIndex) {
  const rates = [];
  for (const p of nowPoints) {
    const q = pastIndex.get(p.key);
    if (!q || !q.priceSqm) continue;
    if (p.lat != null && q.lat != null && haversineKm(p, q) > 0.3) continue;
    rates.push((p.priceSqm / q.priceSqm - 1) * 100);
  }
  return { chg: rates.length ? round2(mean(rates)) : null, count: rates.length };
}
// XIT001 1件 → 土地の坪単価（円/坪）
export function tradeTsubo(row) {
  const unit = parseYen(row.UnitPrice);
  if (unit) return unit * TSUBO;
  const perTsubo = parseYen(row.PricePerUnit);
  if (perTsubo) return perTsubo;
  const total = parseYen(row.TradePrice), area = /以上|未満/.test(String(row.Area || '')) ? null : parseYen(row.Area);
  return total && area ? total / area * TSUBO : null;
}
export function quarterKey(y, q) { return y + 'Q' + q; }
export function prevQuarter(y, q, n = 1) {
  let idx = y * 4 + (q - 1) - n;
  return [Math.floor(idx / 4), (idx % 4) + 1];
}
export function stripVolatile(obj) {
  const { generatedAt, stats, ...rest } = obj || {};
  return JSON.stringify(rest);
}

/* ---------- API クライアント ---------- */

export function createClient({ key, gapMs = 250, retries = 3, fetchImpl = globalThis.fetch, log = () => {} }) {
  let last = 0;
  const stats = { requests: 0, retries: 0 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function get(api, params) {
    const url = new URL(API_BASE + api);
    for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    for (let attempt = 0; ; attempt++) {
      const wait = last + gapMs + Math.floor(Math.random() * 50) - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      let res;
      try {
        stats.requests++;
        res = await fetchImpl(url, { headers: { 'Ocp-Apim-Subscription-Key': key, 'Accept-Encoding': 'gzip' } });
      } catch (err) {
        if (attempt >= retries) throw new Error(api + ' 通信エラー: ' + err.message);
        stats.retries++; await sleep(1000 * 2 ** attempt); continue;
      }
      if (res.status === 401 || res.status === 403) throw new Error('APIキーが無効です（HTTP ' + res.status + '）。REINFOLIB_API_KEY を確認してください');
      if (res.status === 404 || res.status === 204) return null;
      if (res.status === 400) { log('  ' + api + ' 400: ' + url.search.replace(/&?x=\d+|&?y=\d+/g, '')); return null; }
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= retries) throw new Error(api + ' HTTP ' + res.status + '（再試行' + retries + '回で失敗）');
        stats.retries++; await sleep(1000 * 2 ** attempt); continue;
      }
      const text = await res.text();
      if (!text.trim()) return null;
      try { return JSON.parse(text); } catch (_) { throw new Error(api + ' のレスポンスがJSONではありません'); }
    }
  }
  return { get, stats };
}

/* ---------- 取得処理 ---------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
let DATA = path.join(ROOT, 'data');
let ARCHIVE = path.join(DATA, 'archive');
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } };
const writeJson = (file, value, pretty = false) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, pretty ? 1 : 0) + '\n');
};
let log = (...a) => console.log(...a);

async function loadTargets(client) {
  const out = [];
  for (const pref of ['23', '21']) {
    const res = await client.get('XIT002', { area: pref });
    const list = res?.data || [];
    if (!list.length) throw new Error('XIT002 で ' + PREFS[pref] + ' の市区町村一覧が取得できませんでした');
    out.push(...pickTargets(pref, list));
  }
  const want = 16 + 53 + 7; // 名古屋16区＋愛知53市町村＋岐阜7市町
  log('対象市区町村: ' + out.length + '件（想定 ' + want + '件）');
  const missing = [...Object.values(AICHI_REGIONS).flat(), ...Object.values(GIFU_TARGETS).flat()]
    .filter(n => !out.some(c => c.name === n));
  if (missing.length) log('  ⚠ 一覧で見つからなかった名前: ' + missing.join('、'));
  return out;
}

function tileOf(lat, lon) { return lon2x(lon, ZOOM) + '/' + lat2y(lat, ZOOM); }
const PROBE = tileOf(35.17, 136.905); // 名古屋市中区（公示・調査とも必ず地点がある）

async function fetchTile(client, tile, year, classification) {
  const [x, y] = tile.split('/');
  const res = await client.get('XPT002', {
    response_format: 'geojson', z: ZOOM, x, y, year,
    priceClassification: classification, useCategoryCode: USE_CODES
  });
  return Array.isArray(res?.features) ? res.features : [];
}

// 最新年の判定と、land_price_type の値 → 公示/調査 の対応を学習
async function probe(client, thisYear) {
  const latest = {}, mapping = {};
  for (const [kind, cls] of [['koji', 0], ['chosa', 1]]) {
    for (let y = thisYear; y >= thisYear - 3; y--) {
      const features = await fetchTile(client, PROBE, y, cls);
      if (features.length) {
        latest[kind] = y;
        for (const f of features) mapping[String(f.properties?.land_price_type ?? '').trim()] = kind;
        break;
      }
    }
    if (!latest[kind]) throw new Error((kind === 'koji' ? '地価公示' : '地価調査') + 'の最新年を判定できませんでした');
  }
  // 値が公示・調査で重なっていれば区分を判別できない → 区分ごとに別々に取得
  const values = Object.keys(mapping);
  const kojiVals = new Set(), chosaVals = new Set();
  for (const v of values) (mapping[v] === 'koji' ? kojiVals : chosaVals).add(v);
  const separable = kojiVals.size > 0 && chosaVals.size > 0 && [...kojiVals].every(v => !chosaVals.has(v));
  return { latest, mapping: separable ? mapping : null };
}

async function fetchYear(client, { year, kinds, tiles, mapping, targetSet, onTile }) {
  const points = [];
  const jobs = mapping && kinds.length === 2 ? [[null, kinds]] : kinds.map(k => [k === 'koji' ? 0 : 1, [k]]);
  let n = 0;
  for (const tile of tiles) {
    let targetHits = 0;
    for (const [cls, ks] of jobs) {
      const features = await fetchTile(client, tile, year, cls);
      for (const f of features) {
        const kind = cls === 0 ? 'koji' : cls === 1 ? 'chosa' : kindFromType(f.properties?.land_price_type, mapping);
        if (!ks.includes(kind)) continue;
        const p = normalizePoint(f, kind, year);
        if (!p || !targetSet.has(p.cityCode)) continue;
        targetHits++; points.push(p);
      }
    }
    onTile?.(tile, targetHits);
    if (++n % 100 === 0) log('    ' + year + '年: ' + n + '/' + tiles.length + 'タイル（' + points.length + '地点）');
  }
  return dedupe(points);
}

const ROW_KEYS = ['key', 'kind', 'cityCode', 'use', 'priceSqm', 'chg', 'lat', 'lon', 'lot', 'address', 'station', 'pref'];
const packRows = points => points.map(p => ROW_KEYS.map(k => p[k] ?? null));
const unpackRows = (rows, year) => (rows || []).map(r => Object.fromEntries([...ROW_KEYS.map((k, i) => [k, r[i]]), ['year', year]]));

async function fetchTrade(client, targetSet, now) {
  // 取引価格は四半期ごとに約4か月後に追加される。新しい順に探して最初にデータがある期を最新とする。
  let [y, q] = [now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) + 1];
  let latest = null;
  for (let i = 1; i <= 6 && !latest; i++) {
    const [yy, qq] = prevQuarter(y, q, i);
    const res = await client.get('XIT001', { year: yy, quarter: qq, area: '23', priceClassification: '01' });
    if (res?.data?.length) latest = [yy, qq];
  }
  if (!latest) { log('  ⚠ 取引価格の最新四半期が見つかりませんでした'); return null; }
  const quarters = Array.from({ length: 8 }, (_, i) => prevQuarter(latest[0], latest[1], i));
  const rows = [];
  for (const [yy, qq] of quarters) {
    for (const area of ['23', '21']) {
      const res = await client.get('XIT001', { year: yy, quarter: qq, area, priceClassification: '01' });
      for (const r of res?.data || []) {
        const code = String(r.MunicipalityCode || '');
        if (!targetSet.has(code)) continue;
        if (r.PriceCategory && !/取引/.test(r.PriceCategory)) continue;
        rows.push({ code, type: String(r.Type || ''), period: quarterKey(yy, qq), recent: quarters.slice(0, 4).some(([a, b]) => a === yy && b === qq), tsubo: tradeTsubo(r), price: parseYen(r.TradePrice) });
      }
    }
  }
  log('  取引価格: ' + rows.length + '件（' + quarterKey(...quarters[7]) + '〜' + quarterKey(...latest) + '）');
  return {
    rows,
    latestPeriod: quarterKey(...latest),
    period4: quarterKey(...quarters[3]) + '-' + quarterKey(...latest),
    period8: quarterKey(...quarters[7]) + '-' + quarterKey(...latest)
  };
}

export function tradeSummary(rows, code, periods) {
  const mine = rows.filter(r => r.code === code);
  const land = mine.filter(r => r.type === '宅地(土地)' && r.tsubo);
  const house = mine.filter(r => r.type === '宅地(土地と建物)' && r.price);
  const pick = (xs, field, recent) => (recent ? xs.filter(r => r.recent) : xs).map(r => r[field]);
  const l4 = pick(land, 'tsubo', true), h4 = pick(house, 'price', true);
  const l8 = pick(land, 'tsubo', false), h8 = pick(house, 'price', false);
  return {
    landTsuboMedian: roundInt(trimmedMedian(l4)), landCount: l4.length,
    houseMedian: roundInt(trimmedMedian(h4)), houseCount: h4.length,
    period: periods.period4,
    land8: { median: roundInt(trimmedMedian(l8)), count: l8.length },
    house8: { median: roundInt(trimmedMedian(h8)), count: h8.length },
    period8: periods.period8
  };
}

/* ---------- 集計 ---------- */

export function aggregate({ targets, years, latest, trade, now }) {
  const res = p => p.use === RESIDENTIAL;
  const com = p => p.use === COMMERCIAL;
  const latestOf = kind => (years[latest[kind]] || []).filter(p => p.kind === kind);
  const now_ = { koji: latestOf('koji'), chosa: latestOf('chosa') };
  const index = (year, kind) => new Map((years[year] || []).filter(p => p.kind === kind).map(p => [p.key, p]));
  const pastIdx = {};
  for (const kind of ['koji', 'chosa']) for (const back of [5, 10]) pastIdx[kind + back] = index(latest[kind] - back, kind);
  const maxYear = Math.max(latest.koji, latest.chosa);
  const historyYears = Array.from({ length: 11 }, (_, i) => maxYear - 10 + i);

  const longChange = (pts, back) => {
    let rates = [];
    for (const kind of ['koji', 'chosa']) {
      const idx = pastIdx[kind + back];
      for (const p of pts.filter(x => x.kind === kind)) {
        const q = idx.get(p.key);
        if (!q || !q.priceSqm) continue;
        if (p.lat != null && q.lat != null && haversineKm(p, q) > 0.3) continue;
        rates.push((p.priceSqm / q.priceSqm - 1) * 100);
      }
    }
    return rates.length ? round2(mean(rates)) : null;
  };
  const resLatest = [...now_.koji, ...now_.chosa].filter(res);
  const comLatest = [...now_.koji, ...now_.chosa].filter(com);

  const cities = targets.map(t => {
    const kojiPts = now_.koji.filter(p => p.cityCode === t.code && res(p));
    const chosaPts = now_.chosa.filter(p => p.cityCode === t.code && res(p));
    const allPts = [...kojiPts, ...chosaPts];
    const comPts = comLatest.filter(p => p.cityCode === t.code);
    const geo = [...allPts, ...comPts].filter(p => p.lat != null && p.lon != null);
    const centroid = geo.length ? { lat: mean(geo.map(p => p.lat)), lon: mean(geo.map(p => p.lon)) } : null;
    const all = priceStats(allPts);
    return {
      code: t.code, name: t.name, pref: t.pref, region: t.region,
      distFromTajimiKm: centroid ? round1(haversineKm(centroid, TAJIMI)) : null,
      residential: {
        koji: priceStats(kojiPts),
        chosa: priceStats(chosaPts),
        all: { avgSqm: all.avgSqm, medianSqm: all.medianSqm, count: all.count, chg: all.chg },
        chg5y: longChange(allPts, 5),
        chg10y: longChange(allPts, 10),
        history: historyYears.map(y => {
          const pts = (years[y] || []).filter(p => p.cityCode === t.code && res(p));
          return {
            year: y,
            avgSqm: roundInt(mean(pts.map(p => p.priceSqm))),
            koji: roundInt(mean(pts.filter(p => p.kind === 'koji').map(p => p.priceSqm))),
            chosa: roundInt(mean(pts.filter(p => p.kind === 'chosa').map(p => p.priceSqm)))
          };
        }).filter(h => h.avgSqm != null)
      },
      commercial: (({ avgSqm, count, chg }) => ({ avgSqm, count, chg }))(priceStats(comPts)),
      trade: trade ? tradeSummary(trade.rows, t.code, trade) : null
    };
  });

  const areaStats = filter => {
    const pts = resLatest.filter(filter);
    const k = pts.filter(p => p.kind === 'koji'), c = pts.filter(p => p.kind === 'chosa');
    const all = priceStats(pts);
    return { avgSqm: all.avgSqm, chg: all.chg, count: all.count, koji: priceStats(k), chosa: priceStats(c) };
  };
  const codeSet = list => new Set(list.map(t => t.code));
  const prefs = Object.entries(PREFS).map(([code, name]) => {
    const set = codeSet(targets.filter(t => t.prefCode === code));
    return { code, name: code === '21' ? '岐阜県（対象7市町）' : name, residential: areaStats(p => set.has(p.cityCode)) };
  });
  const regions = REGION_ORDER.map(r => {
    const set = codeSet(targets.filter(t => t.region === r));
    return { id: REGION_IDS[r], name: r, residential: areaStats(p => set.has(p.cityCode)) };
  });

  const cityByCode = new Map(targets.map(t => [t.code, t]));
  const groups = new Map();
  for (const p of resLatest) {
    if (!p.station) continue;
    const region = cityByCode.get(p.cityCode)?.region || '';
    const k = p.station + '|' + region;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const stations = [...groups.entries()].map(([k, pts]) => {
    const [name, region] = k.split('|');
    const counts = {};
    for (const p of pts) counts[p.cityCode] = (counts[p.cityCode] || 0) + 1;
    const cityCode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const s = priceStats(pts);
    return { name, region, cityCode, avgSqm: s.avgSqm, count: s.count, chg: s.chg };
  }).sort((a, b) => b.avgSqm - a.avgSqm);

  const pastAny = back => new Map(['koji', 'chosa'].flatMap(kind => [...pastIdx[kind + back].entries()]));
  const past5 = pastAny(5);
  const points = [...resLatest, ...comLatest].map(p => {
    const q = past5.get(p.key);
    const ok = q && q.priceSqm && !(p.lat != null && q.lat != null && haversineKm(p, q) > 0.3);
    return {
      id: p.key, lot: p.lot, cityCode: p.cityCode, kind: p.kind, use: p.use, address: p.address,
      station: p.station, priceSqm: p.priceSqm, chg: p.chg, chg5y: ok ? round1((p.priceSqm / q.priceSqm - 1) * 100) : null,
      lat: p.lat, lon: p.lon
    };
  }).sort((a, b) => b.priceSqm - a.priceSqm);

  return {
    generatedAt: now.toISOString(),
    seed: false,
    sources: {
      koji: { year: latest.koji, baseDate: latest.koji + '-01-01' },
      chosa: { year: latest.chosa, baseDate: latest.chosa + '-07-01' },
      trade: trade ? { latestPeriod: trade.latestPeriod, period: trade.period4, period8: trade.period8 } : null
    },
    prefs, regions, cities, points, stations
  };
}

export function validate(out) {
  const results = [];
  for (const e of EXPECTED) {
    let actual = null;
    const kindYear = out.sources?.[e.kind]?.year;
    if (kindYear !== e.year) { results.push({ ...e, actual: null, diffPct: null, ok: null, note: 'データ年が異なる（' + kindYear + '年）' }); continue; }
    if (e.scope === 'pref') actual = out.prefs.find(p => p.code === e.code)?.residential?.[e.kind];
    else actual = out.cities.find(c => c.name === e.name)?.residential?.[e.kind];
    const v = actual?.avgSqm ?? null;
    const diff = v == null ? null : round1((v / e.avgSqm - 1) * 100);
    results.push({ label: e.label, expected: e.avgSqm, actual: v, diffPct: diff, chgExpected: e.chg, chgActual: actual?.chg ?? null, ok: diff == null ? null : Math.abs(diff) <= 5, partial: !!e.partial });
  }
  return results;
}

/* ---------- メイン ---------- */

// テストから dataDir / fetchImpl / now を差し替えられるように run() として公開
export async function run({ key, args = [], dataDir, fetchImpl, now = new Date(), gapMs = 250, logger } = {}) {
  if (dataDir) { DATA = dataDir; ARCHIVE = path.join(DATA, 'archive'); }
  if (logger) log = logger;
  args = new Set(args);
  const started = Date.now();
  const thisYear = new Date(now.getTime() + 9 * 3600e3).getUTCFullYear();
  const client = createClient({ key, log, gapMs, fetchImpl: fetchImpl || globalThis.fetch });

  log('1) 市区町村コード（XIT002）');
  const targets = await loadTargets(client);
  const targetSet = new Set(targets.map(t => t.code));

  log('2) 最新年の判定（XPT002）');
  const { latest, mapping } = await probe(client, thisYear);
  log('  地価公示 ' + latest.koji + '年 / 地価調査 ' + latest.chosa + '年 / 区分の判別: ' + (mapping ? 'レスポンスで判別' : '区分ごとに取得'));

  const allTiles = tilesFor();
  const cacheFile = path.join(DATA, 'tile-cache.json');
  const cache = readJson(cacheFile, null);
  const ageDays = cache?.fullScanAt ? (Date.now() - Date.parse(cache.fullScanAt)) / 864e5 : Infinity;
  const full = args.has('--full') || !cache || cache.zoom !== ZOOM || !Array.isArray(cache.empty) || ageDays > 365;
  const empty = new Set(full ? [] : cache.empty);
  const hasData = new Set(full ? [] : allTiles.filter(t => !empty.has(t)));
  log('  タイル ' + allTiles.length + '枚' + (full ? '（全タイル走査）' : '（空タイル ' + empty.size + '枚をスキップ）'));

  const maxYear = Math.max(latest.koji, latest.chosa), minLatest = Math.min(latest.koji, latest.chosa);
  const needYears = [];
  for (let y = maxYear; y >= minLatest - 10; y--) needYears.push(y);
  const years = {};
  let scannedAll = false;
  const touched = new Set();
  for (const year of needYears) {
    const file = path.join(ARCHIVE, 'xpt002-' + year + '.json');
    const archived = readJson(file, null);
    const need = ['koji', 'chosa'].filter(k => year <= latest[k] && year >= latest[k] - 10);
    const have = new Set(archived?.kinds || []);
    let missing = need.filter(k => !have.has(k));
    const isLatest = year === latest.koji || year === latest.chosa;
    if (full && isLatest) missing = need.filter(k => year === latest[k] || !have.has(k));
    let points = unpackRows(archived?.rows, year);
    if (missing.length) {
      const scanAll = full && !scannedAll;
      const tiles = scanAll ? allTiles : [...hasData];
      log('3) ' + year + '年 ' + missing.map(k => k === 'koji' ? '地価公示' : '地価調査').join('・') + ' を取得（' + tiles.length + 'タイル）');
      const fresh = await fetchYear(client, {
        year, kinds: missing, tiles, mapping, targetSet,
        onTile: (tile, hits) => { if (hits) hasData.add(tile); else if (scanAll) empty.add(tile); }
      });
      if (scanAll) { scannedAll = true; for (const t of hasData) empty.delete(t); }
      points = dedupe([...points.filter(p => !missing.includes(p.kind)), ...fresh]);
      writeJson(file, { year, kinds: [...new Set([...have, ...missing])].sort(), fetchedAt: now.toISOString(), rows: packRows(points) });
      touched.add(file);
      log('  → ' + points.length + '地点');
    }
    years[year] = points;
  }
  if (scannedAll) {
    writeJson(cacheFile, { zoom: ZOOM, bbox: BBOX, fullScanAt: now.toISOString(), tiles: allTiles.length, empty: [...empty].sort() }, true);
    log('  空タイル ' + empty.size + '枚を記録（次回からスキップ、年1回は全走査）');
  }

  log('4) 取引価格（XIT001）');
  const trade = await fetchTrade(client, targetSet, new Date(now.getTime() + 9 * 3600e3));

  log('5) 集計');
  const out = aggregate({ targets, years, latest, trade, now });
  out.validation = validate(out);
  out.stats = { requests: client.stats.requests, retries: client.stats.retries, seconds: Math.round((Date.now() - started) / 1000), fullScan: full };
  for (const v of out.validation) {
    if (v.ok === null && v.note) log('  検算 ' + v.label + ': ' + v.note);
    else if (v.actual != null) log('  検算 ' + v.label + ': ' + v.actual + ' / 目安 ' + v.expected + '（' + (v.diffPct > 0 ? '+' : '') + v.diffPct + '%）' + (v.ok ? ' ✓' : v.partial ? ' （県の一部のみ集計）' : ' ⚠ ±5%超。集計ロジックを確認'));
  }

  const target = path.join(DATA, 'landprice.json');
  const previous = readJson(target, null);
  const changed = !previous || stripVolatile(previous) !== stripVolatile(out);
  if (changed) {
    writeJson(target, out);
    log('✓ data/landprice.json を更新（市区町村 ' + out.cities.length + '・地点 ' + out.points.length + '・駅 ' + out.stations.length + '）');
  } else log('変更なし（前回と同じ内容のため書き込みません）');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
  log('APIリクエスト ' + client.stats.requests + '回・' + out.stats.seconds + '秒');
  return { out, changed };
}

async function main() {
  const key = process.env.REINFOLIB_API_KEY;
  if (!key) { console.error('REINFOLIB_API_KEY が設定されていません'); process.exit(2); }
  await run({ key, args: process.argv.slice(2) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('✗ ' + err.message); process.exit(1); });
}
