/**
 * Build leaf stamp index (+ packed geometries) from admdongkor GeoJSON.
 * Keep: 동 everywhere; 읍·면 only under 군 (도농복합 시 읍·면 drop).
 *
 * Usage: node scripts/build-dong-assets.cjs [/path/to.geojson]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC =
  process.argv[2] ||
  path.join('/tmp', 'hangjeongdong.geojson');
const OUT_INDEX = path.join(ROOT, 'assets/geo/dongs-by-sido-city.json');
const OUT_GEO = path.join(ROOT, 'assets/geo/dongs.json');

const SIDO_FROM_FULL = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

const METRO = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
]);

function parentCity(sido, sggnm) {
  if (!sggnm) {
    return null;
  }
  // 기장군 / 가평군 — stamp city is the 군 itself.
  if (sggnm.endsWith('군')) {
    return sggnm;
  }
  if (METRO.has(sido)) {
    return sido === '세종' ? '세종시' : sido;
  }
  const m = sggnm.match(/^(.+?시)/);
  return m ? m[1] : null;
}

function leafName(admNm) {
  const parts = String(admNm).trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

/** 동 always; 읍·면 only when stamp city is a 군. */
function keepLeaf(name, city) {
  if (name.endsWith('동')) {
    return true;
  }
  if (city.endsWith('군') && (name.endsWith('읍') || name.endsWith('면'))) {
    return true;
  }
  return false;
}

/** Keep points at least `minDeg` apart (cheap simplify). */
function thinRing(ring, minDeg) {
  if (ring.length <= 4) {
    return ring;
  }
  const out = [ring[0]];
  let last = ring[0];
  for (let i = 1; i < ring.length - 1; i += 1) {
    const p = ring[i];
    const dx = p[0] - last[0];
    const dy = p[1] - last[1];
    if (dx * dx + dy * dy >= minDeg * minDeg) {
      out.push(p);
      last = p;
    }
  }
  out.push(ring[ring.length - 1]);
  if (out.length < 4) {
    return ring;
  }
  // close
  const a = out[0];
  const b = out[out.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) {
    out.push([a[0], a[1]]);
  }
  return out;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function packGeometry(geom) {
  const minDeg = 0.004; // ~400m — atlas scale
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates.map((r) =>
      thinRing(
        r.map((c) => [round4(c[0]), round4(c[1])]),
        minDeg,
      ),
    );
    return { type: 'Polygon', coordinates: [rings] };
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates.map((poly) =>
      poly.map((r) =>
        thinRing(
          r.map((c) => [round4(c[0]), round4(c[1])]),
          minDeg,
        ),
      ),
    );
    return { type: 'MultiPolygon', coordinates: polys };
  }
  return null;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('missing source', SRC);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  /** @type {Record<string, Record<string, string[]>>} */
  const index = {};
  /** @type {{ id: string, sido: string, city: string, name: string, type: string, coordinates: unknown }[]} */
  const geos = [];
  const seen = new Set();

  for (const f of raw.features) {
    const p = f.properties;
    const sido = SIDO_FROM_FULL[p.sidonm];
    if (!sido) {
      continue;
    }
    const city = parentCity(sido, p.sggnm);
    if (!city) {
      continue;
    }
    const name = leafName(p.adm_nm);
    if (!keepLeaf(name, city)) {
      continue;
    }
    const key = `${sido}/${city}/${name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!index[sido]) {
      index[sido] = {};
    }
    if (!index[sido][city]) {
      index[sido][city] = [];
    }
    index[sido][city].push(name);

    const packed = packGeometry(f.geometry);
    if (packed) {
      geos.push({
        id: key,
        sido,
        city,
        name,
        type: packed.type,
        coordinates: packed.coordinates,
      });
    }
  }

  // stable sort
  for (const sido of Object.keys(index)) {
    for (const city of Object.keys(index[sido])) {
      index[sido][city].sort((a, b) => a.localeCompare(b, 'ko'));
    }
  }

  fs.writeFileSync(OUT_INDEX, `${JSON.stringify(index)}\n`);
  fs.writeFileSync(OUT_GEO, `${JSON.stringify({ dongs: geos })}\n`);
  const cityCount = Object.values(index).reduce(
    (n, cities) => n + Object.keys(cities).length,
    0,
  );
  console.log(
    'wrote',
    OUT_INDEX,
    'sidos',
    Object.keys(index).length,
    'cities',
    cityCount,
    'dongs',
    seen.size,
  );
  console.log('wrote', OUT_GEO, 'bytes', fs.statSync(OUT_GEO).size);
}

main();
