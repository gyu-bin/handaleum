/**
 * Build assets/geo/cities-by-sido.json (+ flat sigungu-by-sido.json for totals).
 *
 * Shape: { [sido]: { [city]: string[] } }
 * - units length > 0 → stamps are 구/군 names under that city
 * - units length === 0 → stamp grain is the city itself (파주시, 가평군, …)
 *
 * Sources:
 * - districts.json → metro: { 서울: { 서울: [구…] } }
 * - dong-gu.json → 일반구 시 → 구[]
 * - municipalities.json → 구 없는 시 (일반구 모시 제외) → []
 * - KOSTAT → 도내 군 → []
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
const OUT_CITIES = join(ROOT, 'assets/geo/cities-by-sido.json');
const OUT_FLAT = join(ROOT, 'assets/geo/sigungu-by-sido.json');
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

/** Metro / special: stamp under a single city key equal to short sido. */
const METRO_CITY_KEY = {
  서울: '서울',
  부산: '부산',
  대구: '대구',
  인천: '인천',
  광주: '광주',
  대전: '대전',
  울산: '울산',
  세종: '세종',
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

function ensureCity(out, sido, city) {
  if (!out[sido][city]) {
    out[sido][city] = [];
  }
}

const out = {};
for (const prov of p.provinces) {
  out[prov.name] = {};
}

for (const x of d.districts) {
  const sido = byId[String(x.id).slice(0, 2)];
  if (!sido || !out[sido]) {
    continue;
  }
  const city = METRO_CITY_KEY[sido] ?? sido;
  ensureCity(out, sido, city);
  out[sido][city].push(x.name);
}

for (const city of GENERAL_GU_CITIES) {
  const sido = CITY_TO_SIDO[city];
  if (!sido || !out[sido]) {
    console.warn('pack-cities: no sido for', city);
    continue;
  }
  ensureCity(out, sido, city);
  for (const gu of new Set(Object.values(dg[city]))) {
    out[sido][city].push(gu);
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
  // Skip names that are already metro city keys with districts.
  if (METRO_CITY_KEY[sido] === x.name || (out[sido][x.name] && out[sido][x.name].length > 0)) {
    continue;
  }
  ensureCity(out, sido, x.name);
}

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
  ensureCity(out, sido, name);
  gunCount += 1;
}

const flat = {};
for (const sido of Object.keys(out)) {
  const cities = out[sido];
  for (const city of Object.keys(cities)) {
    cities[city] = [...new Set(cities[city])].sort((a, b) => a.localeCompare(b, 'ko'));
  }
  const sortedCities = {};
  for (const city of Object.keys(cities).sort((a, b) => a.localeCompare(b, 'ko'))) {
    sortedCities[city] = cities[city];
  }
  out[sido] = sortedCities;

  const units = [];
  for (const [city, gus] of Object.entries(sortedCities)) {
    if (gus.length === 0) {
      units.push(city);
    } else {
      units.push(...gus);
    }
  }
  flat[sido] = [...new Set(units)].sort((a, b) => a.localeCompare(b, 'ko'));
}

writeFileSync(OUT_CITIES, `${JSON.stringify(out, null, 2)}\n`);
writeFileSync(OUT_FLAT, `${JSON.stringify(flat, null, 2)}\n`);

const cityCount = Object.values(out).reduce((n, c) => n + Object.keys(c).length, 0);
const unitCount = Object.values(flat).reduce((n, a) => n + a.length, 0);
console.log(
  `wrote ${OUT_CITIES} + ${OUT_FLAT} (${Object.keys(out).length} sidos, ${cityCount} cities, ${unitCount} stamp units, ${gunCount} gun)`,
);
