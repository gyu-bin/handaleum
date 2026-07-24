/**
 * Pack metro 자치구 polygons into assets/geo/districts.json.
 *
 * Source: southkorea/southkorea-maps KOSTAT 2013 municipalities (simplified).
 * Scope: 특별시·광역시 자치구 only (name ends with 구).
 *
 * Usage:
 *   node scripts/pack-districts.mjs [path/to/skorea_municipalities_geo_simple.json]
 * Default downloads the upstream file into /tmp if missing.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'assets/geo/districts.json');
const DEFAULT_URL =
  'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo.json';
const DEFAULT_CACHE = '/tmp/handaleum-geo/muni_full.geojson';

/** KOSTAT 2013 sido prefixes for 서울·부산·대구·인천·광주·대전·울산. */
const METRO_PREFIXES = new Set(['11', '21', '22', '23', '24', '25', '26']);

const ROUND = 4;
/** Douglas-Peucker epsilon in degrees — keeps ~시 sketch density from full rings. */
const EPSILON = 0.00055;

function round(n) {
  const f = 10 ** ROUND;
  return Math.round(n * f) / f;
}

function perpendicularDistance(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

function douglasPeucker(points, epsilon) {
  if (points.length < 3) {
    return points;
  }
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[end]];
}

function simplifyRing(ring) {
  if (ring.length < 4) {
    return ring.map(([lng, lat]) => [round(lng), round(lat)]);
  }
  const closed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring;
  let simplified = douglasPeucker(open, EPSILON);
  if (simplified.length < 3) {
    simplified = open.slice(0, 3);
  }
  const out = simplified.map(([lng, lat]) => [round(lng), round(lat)]);
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]]);
  }
  return out;
}

function packGeometry(geometry) {
  if (geometry.type === 'Polygon') {
    return {
      type: 'MultiPolygon',
      coordinates: [geometry.coordinates.map(simplifyRing)],
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((poly) => poly.map(simplifyRing)),
    };
  }
  throw new Error(`Unsupported geometry ${geometry.type}`);
}

function loadSource(pathArg) {
  const path = pathArg || DEFAULT_CACHE;
  if (!existsSync(path)) {
    execSync(`mkdir -p $(dirname "${path}") && curl -sL -o "${path}" "${DEFAULT_URL}"`, {
      stdio: 'inherit',
    });
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const source = loadSource(process.argv[2]);
const districts = [];

for (const feature of source.features) {
  const code = String(feature.properties.code);
  const name = feature.properties.name;
  if (!METRO_PREFIXES.has(code.slice(0, 2))) {
    continue;
  }
  if (!/구$/.test(name)) {
    continue;
  }
  const packed = packGeometry(feature.geometry);
  districts.push({
    id: code,
    name,
    type: packed.type,
    coordinates: packed.coordinates,
  });
}

districts.sort((a, b) => a.id.localeCompare(b.id));

const payload = { districts };
const json = JSON.stringify(payload);
writeFileSync(OUT, json);
console.log(
  `Wrote ${districts.length} districts → ${OUT} (${(json.length / 1024).toFixed(1)} KB)`,
);
console.log(districts.map((d) => d.name).join(', '));
