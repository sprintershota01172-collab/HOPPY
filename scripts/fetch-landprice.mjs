#!/usr/bin/env node
// 地価調べ君 地価ランキング集計スクリプト（Node 20 以上・APIキー不要）
//
//   node scripts/fetch-landprice.mjs
//   REINFOLIB_API_KEY=xxxx node scripts/fetch-landprice.mjs   # 任意：取引価格（実勢・中古戸建）も集計
//
// 地価公示・地価調査：国土数値情報（国土交通省）のダウンロードデータ（登録不要・無料）
//   https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-26/L01-26_23_GML.zip （地価公示・愛知）など
//   1ファイルに各地点の過去の価格も入っているため、10年の推移も同じファイルから計算できる。
// 取引価格（任意）：不動産情報ライブラリAPI XIT001（APIキーがある場合だけ）
// 出力：data/landprice.json（中身が前回と同じなら書き換えない）

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const KSJ_BASE = 'https://nlftp.mlit.go.jp/ksj/gml/data/';
export const API_BASE = 'https://www.reinfolib.mlit.go.jp/ex-api/external/';
export const TSUBO = 3.305785;
export const TAJIMI = { lat: 35.334, lon: 137.121 };
export const RESIDENTIAL = '住宅地';
export const COMMERCIAL = '商業地';
export const USE_NAMES = { '000': '住宅地', '003': '宅地見込地', '005': '商業地', '007': '準工業地', '009': '工業地', '010': '調整区域内宅地', '013': '林地', '020': '林地' };
export const PREFS = { '23': '愛知県', '21': '岐阜県' };
export const REGION_ORDER = ['名古屋市', '尾張', '知多', '西三河', '東三河', '東濃', '中濃'];
export const REGION_IDS = { 名古屋市: 'nagoya', 尾張: 'owari', 知多: 'chita', 西三河: 'nishimikawa', 東三河: 'higashimikawa', 東濃: 'tono', 中濃: 'chuno' };
export const AICHI_REGIONS = {
  尾張: ['一宮市', '瀬戸市', '春日井市', '津島市', '犬山市', '江南市', '小牧市', '稲沢市', '尾張旭市', '岩倉市',
    '豊明市', '日進市', '愛西市', '清須市', '北名古屋市', '弥富市', 'あま市', '長久手市',
    '東郷町', '豊山町', '大口町', '扶桑町', '大治町', '蟹江町', '飛島村'],
  知多: ['半田市', '常滑市', '東海市', '大府市', '知多市', '阿久比町', '東浦町', '南知多町', '美浜町', '武豊町'],
  西三河: ['岡崎市', '碧南市', '刈谷市', '豊田市', '安城市', '西尾市', '知立市', '高浜市', 'みよし市', '幸田町'],
  東三河: ['豊橋市', '豊川市', '蒲郡市', '新城市', '田原市', '設楽町', '東栄町', '豊根村']
};
export const GIFU_TARGETS = { 東濃: ['多治見市', '土岐市', '瑞浪市', '恵那市'], 中濃: ['可児市', '御嵩町', '美濃加茂市'] };

// 市区町村コード（全国地方公共団体コード）。APIキーなしで対象を確定するために使う。
// APIキーがあれば XIT002 の一覧と名前を照合し、ずれていればログに警告を出す。
export const CITY_CODES = {
  '23101': '名古屋市千種区', '23102': '名古屋市東区', '23103': '名古屋市北区', '23104': '名古屋市西区',
  '23105': '名古屋市中村区', '23106': '名古屋市中区', '23107': '名古屋市昭和区', '23108': '名古屋市瑞穂区',
  '23109': '名古屋市熱田区', '23110': '名古屋市中川区', '23111': '名古屋市港区', '23112': '名古屋市南区',
  '23113': '名古屋市守山区', '23114': '名古屋市緑区', '23115': '名古屋市名東区', '23116': '名古屋市天白区',
  '23201': '豊橋市', '23202': '岡崎市', '23203': '一宮市', '23204': '瀬戸市', '23205': '半田市', '23206': '春日井市',
  '23207': '豊川市', '23208': '津島市', '23209': '碧南市', '23210': '刈谷市', '23211': '豊田市', '23212': '安城市',
  '23213': '西尾市', '23214': '蒲郡市', '23215': '犬山市', '23216': '常滑市', '23217': '江南市', '23219': '小牧市',
  '23220': '稲沢市', '23221': '新城市', '23222': '東海市', '23223': '大府市', '23224': '知多市', '23225': '知立市',
  '23226': '尾張旭市', '23227': '高浜市', '23228': '岩倉市', '23229': '豊明市', '23230': '日進市', '23231': '田原市',
  '23232': '愛西市', '23233': '清須市', '23234': '北名古屋市', '23235': '弥富市', '23236': 'みよし市', '23237': 'あま市',
  '23238': '長久手市', '23302': '東郷町', '23342': '豊山町', '23361': '大口町', '23362': '扶桑町', '23424': '大治町',
  '23425': '蟹江町', '23427': '飛島村', '23441': '阿久比町', '23442': '東浦町', '23445': '南知多町', '23446': '美浜町',
  '23447': '武豊町', '23501': '幸田町', '23561': '設楽町', '23562': '東栄町', '23563': '豊根村',
  '21204': '多治見市', '21208': '瑞浪市', '21210': '恵那市', '21211': '美濃加茂市', '21212': '土岐市', '21214': '可児市',
  '21521': '御嵩町'
};

// 7章の検算値（住宅地の平均 円/㎡）
export const EXPECTED = [
  { scope: 'pref', code: '23', kind: 'koji', year: 2026, avgSqm: 132130, chg: 1.79, label: '愛知県 2026年 地価公示' },
  { scope: 'pref', code: '23', kind: 'chosa', year: 2026, avgSqm: 122706, chg: 1.32, label: '愛知県 2026年 地価調査' },
  { scope: 'pref', code: '21', kind: 'koji', year: 2026, avgSqm: 46640, chg: -0.22, label: '岐阜県 2026年 地価公示' },
  { scope: 'pref', code: '21', kind: 'chosa', year: 2026, avgSqm: 33337, chg: -0.73, label: '岐阜県 2026年 地価調査' },
  { scope: 'city', name: '多治見市', kind: 'koji', year: 2026, avgSqm: 38937, chg: 0.32, label: '多治見市 2026年 地価公示' },
  { scope: 'city', name: '多治見市', kind: 'chosa', year: 2026, avgSqm: 36461, chg: -0.09, label: '多治見市 2026年 地価調査' },
  { scope: 'city', name: '可児市', kind: 'koji', year: 2026, avgSqm: 31600, chg: -0.27, label: '可児市 2026年 地価公示' },
  { scope: 'city', name: '小牧市', kind: 'koji', year: 2026, avgSqm: 92195, chg: 1.90, label: '小牧市 2026年 地価公示' },
  { scope: 'city', name: '春日井市', kind: 'chosa', year: 2025, avgSqm: 118381, chg: 2.67, label: '春日井市 2025年 地価調査' },
  { scope: 'city', name: '瀬戸市', kind: 'chosa', year: 2025, avgSqm: 60678, chg: 1.06, label: '瀬戸市 2025年 地価調査' }
];

/* ---------- 小さな純関数（tests/landprice.test.cjs で検証） ---------- */

export function parseYen(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = String(value).replace(/[,，\s]/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
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
export function regionOfName(code, name) {
  if (/^231\d\d$/.test(code)) return '名古屋市';
  for (const [region, list] of Object.entries({ ...AICHI_REGIONS, ...GIFU_TARGETS })) if (list.includes(name)) return region;
  return null;
}
export function targetList() {
  return Object.entries(CITY_CODES).map(([code, name]) => ({
    code, name, prefCode: code.slice(0, 2), pref: PREFS[code.slice(0, 2)], region: regionOfName(code, name)
  }));
}
export const ksjUrl = (dataset, year, pref) => {
  const yy = String(year % 100).padStart(2, '0');
  return KSJ_BASE + dataset + '/' + dataset + '-' + yy + '/' + dataset + '-' + yy + '_' + pref + '_GML.zip';
};

/* ---------- 国土数値情報の読み取り ---------- */

// 属性の番号（L01_008 など）は年度ごとに変わるため、中身から列を判定する
const keyOrder = k => { const m = String(k).match(/(\d+)\s*$/); return m ? Number(m[1]) : 1e9; };
const isNum = v => v !== null && v !== '' && v !== undefined && Number.isFinite(Number(v));
export function detectSchema(features, { pref, year }) {
  const sample = features.slice(0, 600).map(f => f.properties || {});
  if (!sample.length) throw new Error('地点データが空です');
  const keys = [...new Set(sample.flatMap(p => Object.keys(p)))].sort((a, b) => keyOrder(a) - keyOrder(b) || String(a).localeCompare(b));
  const frac = (key, pred) => key == null ? 0 : sample.filter(p => pred(p[key], p)).length / sample.length;
  const after = (key, n = 1) => keys[keys.indexOf(key) + n];
  const find = (pred, min = 0.9, from = 0) => keys.slice(Math.max(0, from)).find(k => frac(k, pred) >= min);
  const cityKey = find(v => /^\d{5}$/.test(String(v ?? '').trim()) && String(v).trim().startsWith(pref));
  const useKey = find(v => /^\d{1,3}$/.test(String(v ?? '').trim()) && Object.prototype.hasOwnProperty.call(USE_NAMES, String(v).trim().padStart(3, '0')));
  const yearKey = find(v => Number(v) === year, 0.9);
  if (!cityKey || !useKey || !yearKey) throw new Error('列を判定できません（市区町村コード=' + cityKey + ' 用途=' + useKey + ' 年度=' + yearKey + '）');
  const priceKey = after(yearKey);
  if (frac(priceKey, v => isNum(v) && Number(v) >= 100 && Number(v) < 1e8) < 0.9) throw new Error('価格の列を判定できません（年度の次の列 ' + priceKey + '）');
  const chgKey = after(priceKey);
  const chgOk = frac(chgKey, v => v === null || v === '' || v === undefined || (isNum(v) && Math.abs(Number(v)) < 100)) >= 0.9;
  const seqKey = after(useKey);
  const seqOk = frac(seqKey, v => /^\d{1,3}$/.test(String(v ?? '').trim())) >= 0.9;
  // 住所（所在並びに地番）と、その直前の標準地名（「多治見」など）
  const addressKey = find(v => typeof v === 'string' && /[0-9０-９]/.test(v) && /(番|丁目|字|地先)/.test(v), 0.6, keys.indexOf(chgKey));
  const nameKey = addressKey ? after(addressKey, -1) : null;
  const nameOk = !!nameKey && frac(nameKey, v => typeof v === 'string' && v.length >= 1 && v.length <= 8 && !/\d/.test(v)) >= 0.8;
  // 最寄り駅：住所より後ろで、数字を含まない短い文字列のうち、値の種類が最も多い列
  let stationKey = null, best = 0;
  if (addressKey) for (const k of keys.slice(keys.indexOf(addressKey) + 2)) {
    const vals = sample.map(p => p[k]).filter(v => typeof v === 'string' && v.trim() && v !== '_');
    if (vals.length < sample.length * 0.8 || vals.some(v => /\d/.test(v))) continue;
    const avg = vals.reduce((a, v) => a + v.length, 0) / vals.length;
    if (avg < 1.5 || avg > 7) continue;
    const distinct = new Set(vals).size / vals.length;
    if (distinct > best) { best = distinct; stationKey = k; }
  }
  if (best < 0.15) stationKey = null;
  // 土地の条件：駅までの距離・前面道路の方位と幅員・側道（角地など）・用途地域・地積
  const DIRS = new Set(['北', '北東', '東', '南東', '南', '南西', '西', '北西']);
  const isDir = v => typeof v === 'string' && DIRS.has(v.trim());
  const emptyish = v => v === null || v === undefined || v === '' || v === '_' || v === '0';
  const startAt = addressKey ? keys.indexOf(addressKey) + 1 : 0;
  const near = (from, n, pred, min) => from < 0 ? null : keys.slice(from, from + n).find(k => frac(k, pred) >= min) || null;
  const areaKey = near(startAt, 4, v => isNum(v) && Number(v) >= 20 && Number(v) <= 200000, 0.9);
  const dirKey = keys.slice(startAt).find(k => frac(k, isDir) >= 0.6) || null;
  const roadWidthKey = dirKey ? near(keys.indexOf(dirKey) + 1, 2, v => isNum(v) && Number(v) >= 0 && Number(v) <= 80, 0.85) : null;
  let sideDirKey = null;
  if (dirKey) for (const k of keys.slice(keys.indexOf(dirKey) + 1, keys.indexOf(dirKey) + 8)) {
    const share = frac(k, isDir);
    if (share >= 0.02 && share < 0.7 && frac(k, v => isDir(v) || emptyish(v)) >= 0.97) { sideDirKey = k; break; }
  }
  const stationDistKey = stationKey ? near(keys.indexOf(stationKey) + 1, 3, v => isNum(v) && Number(v) >= 0 && Number(v) <= 40000, 0.9) : null;
  const zoneKey = keys.slice(startAt).find(k => frac(k, v => typeof v === 'string' && /(低専|中専|住居|近商|商業|準工|工業|工専|田園)/.test(v)) >= 0.6) || null;
  // 価格の推移列：当年価格と同じ値が入っている列（価格列より後ろ）を当年とし、その前を過去年とみなす
  let histIndex = -1;
  for (let i = keys.indexOf(priceKey) + 2; i < keys.length; i++) {
    if (frac(keys[i], (v, p) => isNum(v) && Number(v) === Number(p[priceKey])) >= 0.85 &&
        frac(keys[i - 1], isNum) >= 0.9 && frac(keys[i - 2], isNum) >= 0.9) { histIndex = i; break; }
  }
  const history = [];
  if (histIndex > 0) for (let i = histIndex, y = year; i >= 0 && y >= year - 12; i--, y--) {
    if (frac(keys[i], isNum) < 0.9) break;
    history.push([y, keys[i]]);
  }
  return { cityKey, useKey, seqKey: seqOk ? seqKey : null, yearKey, priceKey, chgKey: chgOk ? chgKey : null,
    addressKey: addressKey || null, nameKey: nameOk ? nameKey : null, stationKey, history,
    areaKey, dirKey, roadWidthKey, sideDirKey, stationDistKey, zoneKey };
}
export function pointsFromFeatures(features, schema, { kind, year }) {
  const s = schema, out = [];
  for (const f of features) {
    const p = f.properties || {};
    const c = f.geometry?.coordinates || [];
    const price = Number(p[s.priceKey]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const city = String(p[s.cityKey] ?? '').trim();
    const useCode = String(p[s.useKey] ?? '').trim().padStart(3, '0');
    const seq = s.seqKey ? String(p[s.seqKey] ?? '').trim() : '';
    const name = s.nameKey ? String(p[s.nameKey] ?? '').trim() : '';
    const lot = name && seq ? name + (useCode === '000' ? '' : String(Number(useCode))) + '-' + Number(seq) : '';
    const hist = {};
    for (const [y, k] of s.history) { const v = Number(p[k]); if (Number.isFinite(v) && v > 0) hist[y] = v; }
    hist[year] = price;
    const station = s.stationKey ? String(p[s.stationKey] ?? '').trim() : '';
    out.push({
      key: kind + '|' + city + '|' + useCode + '|' + (seq || (s.addressKey ? p[s.addressKey] : '') || out.length),
      kind, year, cityCode: city, pref: city.slice(0, 2), use: USE_NAMES[useCode] || useCode, useCode, lot,
      address: s.addressKey ? String(p[s.addressKey] ?? '').trim() : '',
      station: station === '_' ? '' : station.replace(/駅$/, ''), priceSqm: price,
      chg: s.chgKey ? parseRate(p[s.chgKey]) : null,
      lat: Number.isFinite(+c[1]) ? Math.round(c[1] * 1e5) / 1e5 : null,
      lon: Number.isFinite(+c[0]) ? Math.round(c[0] * 1e5) / 1e5 : null,
      hist,
      area: s.areaKey && isNum(p[s.areaKey]) ? Number(p[s.areaKey]) : null,
      dir: s.dirKey ? String(p[s.dirKey] ?? '').trim() || null : null,
      road: s.roadWidthKey && isNum(p[s.roadWidthKey]) && Number(p[s.roadWidthKey]) > 0 ? Number(p[s.roadWidthKey]) : null,
      side: s.sideDirKey ? ['北', '北東', '東', '南東', '南', '南西', '西', '北西'].includes(String(p[s.sideDirKey] ?? '').trim()) : null,
      dist: s.stationDistKey && isNum(p[s.stationDistKey]) ? Number(p[s.stationDistKey]) : null,
      zone: s.zoneKey ? zoneGroup(p[s.zoneKey]) : null
    });
  }
  return out;
}

// 用途地域をざっくり5つに分ける（相場の条件・土地ガイド用）
export function zoneGroup(v) {
  const s = String(v ?? '');
  if (/低専|田園/.test(s)) return '低層住居';
  if (/中専/.test(s)) return '中高層住居';
  if (/住居/.test(s)) return '住居';
  if (/近商|商業/.test(s)) return '商業';
  if (/準工|工業|工専/.test(s)) return '工業';
  return s.trim() ? 'その他' : null;
}
export const distBand = m => m == null ? null : m < 500 ? '〜500m' : m < 1000 ? '500m〜1km' : m < 2000 ? '1〜2km' : '2km〜';
export const dirGroup = d => !d ? null : /南/.test(d) ? '南' : /北/.test(d) ? '北' : d === '東' ? '東' : d === '西' ? '西' : null;
export const roadBand = w => w == null ? null : w < 4 ? '4m未満' : w < 6 ? '4〜6m' : '6m以上';

// シェープファイル（.dbf/.shp）の最小限の読み取り。zip に GeoJSON が無い場合に使う。
export function parseDbf(buf, encoding = 'utf-8') {
  const count = buf.readUInt32LE(4), headerLen = buf.readUInt16LE(8), recLen = buf.readUInt16LE(10);
  const fields = [];
  for (let off = 32; off < headerLen - 1 && buf[off] !== 0x0d; off += 32) {
    const name = buf.subarray(off, off + 11).toString('latin1').replace(/\0.*$/, '').trim();
    fields.push({ name, type: String.fromCharCode(buf[off + 11]), len: buf[off + 16] });
  }
  let dec;
  try { dec = new TextDecoder(encoding); } catch (_) { dec = new TextDecoder('utf-8'); }
  const rows = [];
  for (let i = 0; i < count; i++) {
    const base = headerLen + i * recLen;
    if (buf[base] === 0x2a) continue;
    let pos = base + 1;
    const row = {};
    for (const f of fields) {
      const raw = dec.decode(buf.subarray(pos, pos + f.len)).replace(/\0/g, '').trim();
      pos += f.len;
      row[f.name] = (f.type === 'N' || f.type === 'F') ? (raw === '' ? null : Number(raw)) : raw;
    }
    rows.push(row);
  }
  return rows;
}
export function parseShpPoints(buf) {
  const out = [];
  let off = 100;
  while (off + 12 <= buf.length) {
    const len = buf.readInt32BE(off + 4) * 2, type = buf.readInt32LE(off + 8);
    out.push(type === 1 ? [buf.readDoubleLE(off + 12), buf.readDoubleLE(off + 20)] : null);
    off += 8 + len;
  }
  return out;
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}
export function readFeaturesFromDir(dir) {
  const files = walk(dir);
  const geojson = files.find(f => /\.geojson$/i.test(f));
  if (geojson) return JSON.parse(fs.readFileSync(geojson, 'utf8').replace(/^﻿/, '')).features || [];
  const shp = files.find(f => /\.shp$/i.test(f));
  const dbf = shp && files.find(f => f.toLowerCase() === shp.toLowerCase().replace(/\.shp$/, '.dbf'));
  if (!shp || !dbf) throw new Error('zip の中に GeoJSON もシェープファイルもありません');
  const cpg = files.find(f => /\.cpg$/i.test(f));
  let enc = cpg ? fs.readFileSync(cpg, 'utf8').trim().toLowerCase() : 'utf-8';
  if (/932|sjis|shift/.test(enc)) enc = 'shift_jis';
  const rows = parseDbf(fs.readFileSync(dbf), enc), pts = parseShpPoints(fs.readFileSync(shp));
  return rows.map((properties, i) => ({ type: 'Feature', properties, geometry: pts[i] ? { type: 'Point', coordinates: pts[i] } : null }));
}

/* ---------- 取引価格（APIキーがある場合だけ） ---------- */

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
  const idx = y * 4 + (q - 1) - n;
  return [Math.floor(idx / 4), (idx % 4) + 1];
}
export function createClient({ key, gapMs = 250, retries = 3, fetchImpl = globalThis.fetch }) {
  let last = 0;
  const stats = { requests: 0 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function get(api, params) {
    const url = new URL(API_BASE + api);
    for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    for (let attempt = 0; ; attempt++) {
      const wait = last + gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      let res;
      try { stats.requests++; res = await fetchImpl(url, { headers: { 'Ocp-Apim-Subscription-Key': key } }); }
      catch (err) { if (attempt >= retries) throw new Error(api + ' 通信エラー: ' + err.message); await sleep(1000 * 2 ** attempt); continue; }
      if (res.status === 401 || res.status === 403) throw new Error('APIキーが無効です（HTTP ' + res.status + '）');
      if (res.status === 404 || res.status === 204 || res.status === 400) return null;
      if (res.status === 429 || res.status >= 500) { if (attempt >= retries) throw new Error(api + ' HTTP ' + res.status); await sleep(1000 * 2 ** attempt); continue; }
      const text = await res.text();
      return text.trim() ? JSON.parse(text) : null;
    }
  }
  return { get, stats };
}
async function fetchTrade(client, targetSet, nowJst, log) {
  const [y, q] = [nowJst.getUTCFullYear(), Math.floor(nowJst.getUTCMonth() / 3) + 1];
  let latest = null;
  for (let i = 1; i <= 6 && !latest; i++) {
    const [yy, qq] = prevQuarter(y, q, i);
    const res = await client.get('XIT001', { year: yy, quarter: qq, area: '23', priceClassification: '01' });
    if (res?.data?.length) latest = [yy, qq];
  }
  if (!latest) { log('  ⚠ 取引価格の最新四半期が見つかりませんでした'); return null; }
  const quarters = Array.from({ length: 8 }, (_, i) => prevQuarter(latest[0], latest[1], i));
  const rows = [];
  for (const [yy, qq] of quarters) for (const area of ['23', '21']) {
    const res = await client.get('XIT001', { year: yy, quarter: qq, area, priceClassification: '01' });
    for (const r of res?.data || []) {
      const code = String(r.MunicipalityCode || '');
      if (!targetSet.has(code)) continue;
      rows.push({ code, type: String(r.Type || ''), recent: quarters.slice(0, 4).some(([a, b]) => a === yy && b === qq), tsubo: tradeTsubo(r), price: parseYen(r.TradePrice) });
    }
  }
  log('  取引価格: ' + rows.length + '件');
  return { rows, latestPeriod: quarterKey(...latest), period4: quarterKey(...quarters[3]) + '-' + quarterKey(...latest), period8: quarterKey(...quarters[7]) + '-' + quarterKey(...latest) };
}
export function tradeSummary(rows, code, periods) {
  const mine = rows.filter(r => r.code === code);
  const land = mine.filter(r => r.type === '宅地(土地)' && r.tsubo), house = mine.filter(r => r.type === '宅地(土地と建物)' && r.price);
  const pick = (xs, field, recent) => (recent ? xs.filter(r => r.recent) : xs).map(r => r[field]);
  const l4 = pick(land, 'tsubo', true), h4 = pick(house, 'price', true), l8 = pick(land, 'tsubo', false), h8 = pick(house, 'price', false);
  return {
    landTsuboMedian: roundInt(trimmedMedian(l4)), landCount: l4.length, houseMedian: roundInt(trimmedMedian(h4)), houseCount: h4.length,
    period: periods.period4, land8: { median: roundInt(trimmedMedian(l8)), count: l8.length },
    house8: { median: roundInt(trimmedMedian(h8)), count: h8.length }, period8: periods.period8
  };
}

/* ---------- 集計 ---------- */

export function priceStats(points) {
  const prices = points.map(p => p.priceSqm), rates = points.map(p => p.chg).filter(Number.isFinite);
  return { avgSqm: roundInt(mean(prices)), medianSqm: roundInt(median(prices)), count: prices.length, chg: rates.length ? round2(mean(rates)) : null };
}
// 5年・10年の上昇率：同じ地点の過去の価格と比べる（過去に選定されていない地点は除外）
export function longChange(points, latest, back) {
  const rates = [];
  for (const p of points) {
    const past = p.hist?.[latest[p.kind] - back];
    if (past > 0) rates.push((p.priceSqm / past - 1) * 100);
  }
  return rates.length ? round2(mean(rates)) : null;
}
export function aggregate({ targets, points, latest, trade, now }) {
  const res = p => p.use === RESIDENTIAL, com = p => p.use === COMMERCIAL;
  const maxYear = Math.max(latest.koji, latest.chosa);
  const historyYears = Array.from({ length: 11 }, (_, i) => maxYear - 10 + i);
  const cities = targets.map(t => {
    const mine = points.filter(p => p.cityCode === t.code);
    const kojiPts = mine.filter(p => p.kind === 'koji' && res(p)), chosaPts = mine.filter(p => p.kind === 'chosa' && res(p));
    const allPts = [...kojiPts, ...chosaPts], comPts = mine.filter(com);
    const geo = [...allPts, ...comPts].filter(p => p.lat != null && p.lon != null);
    const centroid = geo.length ? { lat: mean(geo.map(p => p.lat)), lon: mean(geo.map(p => p.lon)) } : null;
    const all = priceStats(allPts);
    return {
      code: t.code, name: t.name, pref: t.pref, region: t.region,
      distFromTajimiKm: centroid ? round1(haversineKm(centroid, TAJIMI)) : null,
      residential: {
        koji: priceStats(kojiPts), chosa: priceStats(chosaPts),
        all: { avgSqm: all.avgSqm, medianSqm: all.medianSqm, count: all.count, chg: all.chg },
        chg5y: longChange(allPts, latest, 5), chg10y: longChange(allPts, latest, 10),
        history: historyYears.map(y => {
          const at = kind => allPts.filter(p => p.kind === kind && y <= latest[kind]).map(p => p.hist?.[y]).filter(v => v > 0);
          const k = at('koji'), c = at('chosa');
          return { year: y, avgSqm: roundInt(mean([...k, ...c])), koji: roundInt(mean(k)), chosa: roundInt(mean(c)) };
        }).filter(h => h.avgSqm != null)
      },
      commercial: (({ avgSqm, count, chg }) => ({ avgSqm, count, chg }))(priceStats(comPts)),
      trade: trade ? tradeSummary(trade.rows, t.code, trade) : null
    };
  });
  const areaStats = filter => {
    const pts = points.filter(p => res(p) && filter(p));
    const all = priceStats(pts);
    return { avgSqm: all.avgSqm, chg: all.chg, count: all.count, koji: priceStats(pts.filter(p => p.kind === 'koji')), chosa: priceStats(pts.filter(p => p.kind === 'chosa')) };
  };
  const prefs = Object.entries(PREFS).map(([code, name]) => ({ code, name, residential: areaStats(p => p.pref === code) }));
  const targetCodes = new Set(targets.map(t => t.code));
  const regions = REGION_ORDER.map(r => {
    const set = new Set(targets.filter(t => t.region === r).map(t => t.code));
    return { id: REGION_IDS[r], name: r, residential: areaStats(p => set.has(p.cityCode)) };
  });
  const regionByCode = new Map(targets.map(t => [t.code, t.region]));
  const groups = new Map();
  for (const p of points.filter(p => targetCodes.has(p.cityCode) && res(p))) {
    if (!p.station) continue;
    const k = p.station + '|' + regionByCode.get(p.cityCode);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const stations = [...groups.entries()].map(([k, pts]) => {
    const [name, region] = k.split('|'), counts = {};
    for (const p of pts) counts[p.cityCode] = (counts[p.cityCode] || 0) + 1;
    const s = priceStats(pts);
    return { name, region, cityCode: Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0], avgSqm: s.avgSqm, count: s.count, chg: s.chg };
  }).sort((a, b) => b.avgSqm - a.avgSqm);
  const outPoints = points.filter(p => targetCodes.has(p.cityCode) && (res(p) || com(p))).map(p => {
    const past = p.hist?.[latest[p.kind] - 5];
    return { id: p.key, lot: p.lot, cityCode: p.cityCode, kind: p.kind, use: p.use, address: p.address, station: p.station,
      priceSqm: p.priceSqm, chg: p.chg, chg5y: past > 0 ? round1((p.priceSqm / past - 1) * 100) : null, lat: p.lat, lon: p.lon,
      dist: p.dist, dir: p.dir, road: p.road, side: p.side, zone: p.zone, area: p.area };
  }).sort((a, b) => b.priceSqm - a.priceSqm);
  const conditions = conditionEffects(points.filter(p => targetCodes.has(p.cityCode) && res(p)), regionByCode);
  return {
    generatedAt: now.toISOString(), seed: false, tradeAvailable: !!trade,
    sources: {
      koji: { year: latest.koji, baseDate: latest.koji + '-01-01', from: '国土数値情報（地価公示）' },
      chosa: { year: latest.chosa, baseDate: latest.chosa + '-07-01', from: '国土数値情報（都道府県地価調査）' },
      trade: trade ? { latestPeriod: trade.latestPeriod, period: trade.period4, period8: trade.period8 } : null
    },
    prefs, regions, cities, points: outPoints, stations, conditions
  };
}
// 条件ごとの価格差：同じ市区町村の住宅地平均を100としたときの各地点の価格比を、条件ごとに平均する
export function conditionEffects(points, regionByCode) {
  const cityAvg = new Map();
  for (const p of points) { const a = cityAvg.get(p.cityCode) || [0, 0]; a[0] += p.priceSqm; a[1]++; cityAvg.set(p.cityCode, a); }
  const ratio = p => { const a = cityAvg.get(p.cityCode); return a && a[1] >= 3 ? p.priceSqm / (a[0] / a[1]) : null; };
  const dims = {
    dist: { label: '駅からの距離', order: ['〜500m', '500m〜1km', '1〜2km', '2km〜'], of: p => distBand(p.dist) },
    dir: { label: '前面道路の向き', order: ['南', '東', '西', '北'], of: p => dirGroup(p.dir) },
    corner: { label: '角地・二方道路', order: ['角地・二方道路', '一方道路'], of: p => p.side == null ? null : p.side ? '角地・二方道路' : '一方道路' },
    road: { label: '前面道路の幅', order: ['4m未満', '4〜6m', '6m以上'], of: p => roadBand(p.road) },
    zone: { label: '用途地域', order: ['低層住居', '中高層住居', '住居', '商業', '工業'], of: p => p.zone },
    area: { label: '土地の広さ', order: ['〜50坪', '50〜80坪', '80坪〜'], of: p => p.area == null ? null : p.area / TSUBO < 50 ? '〜50坪' : p.area / TSUBO < 80 ? '50〜80坪' : '80坪〜' }
  };
  const scopes = [['all', () => true], ...REGION_ORDER.map(r => [REGION_IDS[r], p => regionByCode.get(p.cityCode) === r])];
  const out = {};
  for (const [dim, d] of Object.entries(dims)) {
    out[dim] = { label: d.label, order: d.order, scopes: {} };
    for (const [scope, inScope] of scopes) {
      const groups = {};
      for (const p of points) {
        if (!inScope(p)) continue;
        const g = d.of(p), r = ratio(p);
        if (!g || r == null) continue;
        (groups[g] ||= []).push(r);
      }
      out[dim].scopes[scope] = Object.fromEntries(d.order.filter(g => groups[g]?.length).map(g => [g, { pct: round1((mean(groups[g]) - 1) * 100), n: groups[g].length }]));
    }
  }
  return out;
}
export function validate(out) {
  return EXPECTED.map(e => {
    const kindYear = out.sources?.[e.kind]?.year;
    if (kindYear !== e.year) return { label: e.label, expected: e.avgSqm, actual: null, diffPct: null, ok: null, note: 'データ年が異なる（' + kindYear + '年）' };
    const s = e.scope === 'pref' ? out.prefs.find(p => p.code === e.code)?.residential?.[e.kind] : out.cities.find(c => c.name === e.name)?.residential?.[e.kind];
    const v = s?.avgSqm ?? null, diff = v == null ? null : round1((v / e.avgSqm - 1) * 100);
    return { label: e.label, expected: e.avgSqm, actual: v, diffPct: diff, chgExpected: e.chg, chgActual: s?.chg ?? null, ok: diff == null ? null : Math.abs(diff) <= 5 };
  });
}
export function stripVolatile(obj) {
  const { generatedAt, stats, ...rest } = obj || {};
  return JSON.stringify(rest);
}

/* ---------- ダウンロード ---------- */

function defaultUnzip(zip, dir) { execFileSync('unzip', ['-o', '-qq', zip, '-d', dir], { stdio: 'ignore' }); }
export async function downloadKsj({ dataset, year, pref, fetchImpl = globalThis.fetch, workDir, unzip = defaultUnzip }) {
  const url = ksjUrl(dataset, year, pref);
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try { res = await fetchImpl(url); break; }
    catch (err) { if (attempt === 2) throw new Error(url + ' に接続できません: ' + err.message); await new Promise(r => setTimeout(r, 2000 * 2 ** attempt)); }
  }
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(url + ' HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100 || buf.readUInt32LE(0) !== 0x04034b50) return null; // zip 以外（未公開時のHTMLなど）
  const dir = fs.mkdtempSync(path.join(workDir, dataset + '-' + year + '-' + pref + '-'));
  const zip = path.join(dir, 'data.zip');
  fs.writeFileSync(zip, buf);
  unzip(zip, dir);
  return { url, features: readFeaturesFromDir(dir), bytes: buf.length };
}

/* ---------- メイン ---------- */

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } };

export async function run({ key = '', dataDir = path.resolve(here, '..', 'data'), fetchImpl = globalThis.fetch, now = new Date(), logger = console.log, unzip } = {}) {
  const log = logger, started = Date.now();
  const nowJst = new Date(now.getTime() + 9 * 3600e3), thisYear = nowJst.getUTCFullYear();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'landprice-'));
  const targets = targetList(), targetSet = new Set(targets.map(t => t.code));

  log('1) 国土数値情報をダウンロード（登録不要）');
  const latest = {}, points = [];
  for (const [kind, dataset, label] of [['koji', 'L01', '地価公示'], ['chosa', 'L02', '地価調査']]) {
    for (let y = thisYear; y >= thisYear - 2 && !latest[kind]; y--) {
      const got = [];
      for (const pref of ['23', '21']) {
        const file = await downloadKsj({ dataset, year: y, pref, fetchImpl, workDir, unzip });
        if (!file) break;
        got.push([pref, file]);
      }
      if (got.length < 2) { log('  ' + label + ' ' + y + '年: まだ公開されていません'); continue; }
      for (const [pref, file] of got) {
        const schema = detectSchema(file.features, { pref, year: y });
        const pts = pointsFromFeatures(file.features, schema, { kind, year: y });
        log('  ' + label + ' ' + y + '年 ' + PREFS[pref] + ': ' + pts.length + '地点（価格=' + schema.priceKey + ' 変動率=' + schema.chgKey +
          ' 推移=' + schema.history.length + '年分 駅=' + (schema.stationKey || 'なし') + ' 地点名=' + (schema.nameKey || 'なし') + '）');
        log('    条件の列: 地積=' + schema.areaKey + ' 道路方位=' + schema.dirKey + ' 幅員=' + schema.roadWidthKey + ' 側道=' + schema.sideDirKey +
          ' 駅距離=' + schema.stationDistKey + ' 用途地域=' + schema.zoneKey);
        const sample = pts.find(p => p.use === RESIDENTIAL);
        if (sample) log('    例: ' + sample.lot + ' ' + JSON.stringify({ area: sample.area, dir: sample.dir, road: sample.road, side: sample.side, dist: sample.dist, zone: sample.zone }));
        points.push(...pts);
      }
      latest[kind] = y;
    }
    if (!latest[kind]) throw new Error(label + 'のデータが見つかりませんでした（' + ksjUrl(dataset, thisYear, '23') + ' など）');
  }
  const found = new Set(points.map(p => p.cityCode));
  const missing = targets.filter(t => !found.has(t.code));
  if (missing.length) log('  ⚠ 地点が見つからない市区町村: ' + missing.map(t => t.name).join('、'));

  let trade = null;
  if (key) {
    log('2) 取引価格（不動産情報ライブラリAPI）');
    const client = createClient({ key, fetchImpl });
    try {
      for (const area of ['23', '21']) {
        const list = await client.get('XIT002', { area });
        const names = new Map((list?.data || []).map(x => [String(x.id), String(x.name)]));
        for (const t of targets.filter(t => t.prefCode === area)) {
          const n = names.get(t.code);
          if (n && !n.endsWith(t.name.replace(/^名古屋市/, ''))) log('  ⚠ 市区町村名の不一致: ' + t.code + ' ' + t.name + ' / ' + n);
        }
      }
      trade = await fetchTrade(client, targetSet, nowJst, log);
    } catch (err) { log('  ⚠ 取引価格は取得できませんでした: ' + err.message); }
  } else log('2) 取引価格: APIキー未設定のためスキップ（実勢・中古戸建は表示しません）');

  log('3) 集計');
  const out = aggregate({ targets, points, latest, trade, now });
  out.validation = validate(out);
  out.stats = { seconds: Math.round((Date.now() - started) / 1000), points: points.length };
  for (const v of out.validation) {
    if (v.actual == null) log('  検算 ' + v.label + ': ' + (v.note || 'データなし'));
    else log('  検算 ' + v.label + ': ' + v.actual + ' / 目安 ' + v.expected + '（' + (v.diffPct > 0 ? '+' : '') + v.diffPct + '%）' + (v.ok ? ' ✓' : ' ⚠ ±5%超'));
  }
  const target = path.join(dataDir, 'landprice.json');
  const previous = readJson(target, null);
  const changed = !previous || stripVolatile(previous) !== stripVolatile(out);
  if (changed) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(target, JSON.stringify(out) + '\n');
    log('✓ data/landprice.json を更新（市区町村 ' + out.cities.length + '・地点 ' + out.points.length + '・駅 ' + out.stations.length + '）');
  } else log('変更なし（前回と同じ内容のため書き込みません）');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'changed=' + changed + '\n');
  fs.rmSync(workDir, { recursive: true, force: true });
  return { out, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run({ key: process.env.REINFOLIB_API_KEY || '' }).catch(err => { console.error('✗ ' + err.message); process.exit(1); });
}
