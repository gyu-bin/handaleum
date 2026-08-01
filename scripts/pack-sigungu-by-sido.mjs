/**
 * Build assets/geo/sigungu-by-sido.json for 발도장 totals.
 *
 * Sources (1A + 군, 2026-08-01):
 * - districts.json → metro 자치구
 * - dong-gu.json → 일반구 시 구 목록 (서울 제외)
 * - municipalities.json → 구 없는 시 (일반구 모시 제외)
 * - KOSTAT municipalities geo → 도내 군 (name ends with 군)
 *
 * Stamp grain = VisitPlace `gu ?? city` (시군구).
 *
 * Usage: node scripts/pack-sigungu-by-sido.mjs [path/to/skorea_municipalities_geo.json]
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'assets/geo/sigungu-by-sido.json');
const DEFAULT_URL =
  'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo.json';
const DEFAULT_CACHE = '/tmp/handaleum-geo/muni_full.geojson';

const m = require('../assets/geo/municipalities.json');
const d = require('../assets/geo/districts.json');
const p = require('../assets/geo/provinces.json');
const dg = require('../assets/geo/dong-gu.json');

const byId = Object.fromEntries(p.provinces.map((x) => [x.id, x.name]));
const GENERAL_GU_CITIES = new Set(Object.keys(dg).filter((k) => k !== '서울'));

const CITY_TO_SIDO = {
  고양시: '경기',
  성남시: '경기',
  수원시: '경기',
  안산시: '경기',
  안양시: '경기',
  용인시: '경기',
  전주시: '전북',
  창원시: '경남',
  천안시: '충남',
  청주시: '충북',
  포항시: '경북',
};

function loadGunSource(pathArg) {
  const path = pathArg || DEFAULT_CACHE;
  if (!existsSync(path)) {
    execSync(`mkdir -p "$(dirname "${path}")" && curl -sL -o "${path}" "${DEFAULT_URL}"`, {
      stdio: 'inherit',
    });
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const out = {};
for (const prov of p.provinces) {
  out[prov.name] = [];
}

for (const x of d.districts) {
  const sido = byId[String(x.id).slice(0, 2)];
  if (!sido || !out[sido]) {
    continue;
  }
  out[sido].push(x.name);
}

for (const city of GENERAL_GU_CITIES) {
  const sido = CITY_TO_SIDO[city];
  if (!sido || !out[sido]) {
    console.warn('pack-sigungu: no sido for', city);
    continue;
  }
  for (const gu of new Set(Object.values(dg[city]))) {
    out[sido].push(gu);
  }
}

for (const x of m.municipalities) {
  if (GENERAL_GU_CITIES.has(x.name)) {
    continue;
  }
  const sido = byId[String(x.id).slice(0, 2)];
  if (!sido || !out[sido]) {
    continue;
  }
  out[sido].push(x.name);
}

// 군 from full KOSTAT municipalities (names only — no polygons for stamp index).
const gunSource = loadGunSource(process.argv[2]);
let gunCount = 0;
for (const feature of gunSource.features ?? []) {
  const code = String(feature.properties?.code ?? '');
  const name = feature.properties?.name;
  if (!code || !name || !/군$/.test(name)) {
    continue;
  }
  const sido = byId[code.slice(0, 2)];
  if (!sido || !out[sido]) {
    continue;
  }
  out[sido].push(name);
  gunCount += 1;
}

for (const sido of Object.keys(out)) {
  out[sido] = [...new Set(out[sido])].sort((a, b) => a.localeCompare(b, 'ko'));
}

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
const total = Object.values(out).reduce((n, a) => n + a.length, 0);
console.log(
  `wrote ${OUT} (${Object.keys(out).length} sidos, ${total} sigungu, ${gunCount} gun rows)`,
);
