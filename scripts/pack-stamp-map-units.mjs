/**
 * Pack L1 (구·시·군) MultiPolygons for the stamp coloring-book map.
 *
 * Sources: dongs.json + cities-by-sido.json + admin-dong-gu.json
 * Out: assets/geo/stamp-map-units.json
 *
 * Usage: node scripts/pack-stamp-map-units.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'assets/geo/stamp-map-units.json');

const dongs = JSON.parse(
  readFileSync(join(ROOT, 'assets/geo/dongs.json'), 'utf8'),
).dongs;
const citiesBySido = JSON.parse(
  readFileSync(join(ROOT, 'assets/geo/cities-by-sido.json'), 'utf8'),
);
const adminDongGu = JSON.parse(
  readFileSync(join(ROOT, 'assets/geo/admin-dong-gu.json'), 'utf8'),
);

/** @type {Map<string, typeof dongs[0]>} */
const dongById = new Map();
for (const d of dongs) {
  const id = d.id || `${d.sido}/${d.city}/${d.name}`;
  dongById.set(id, d);
  // Also index by sido/city/name for leaves that omit id prefix quirks.
  dongById.set(`${d.sido}/${d.city}/${d.name}`, d);
}

/**
 * @param {string} sido
 * @param {string} stampCity
 * @param {string[] | null} guFilter — when set, only dongs mapped to this 구
 */
function collectCoords(sido, stampCity, guFilter) {
  /** @type {number[][][][]} */
  const coordinates = [];
  const guTable = adminDongGu[stampCity] ?? null;

  for (const d of dongs) {
    if (d.sido !== sido || d.city !== stampCity) {
      continue;
    }
    if (guFilter) {
      const gu = guTable?.[d.name];
      if (gu !== guFilter) {
        continue;
      }
    }
    if (!Array.isArray(d.coordinates)) {
      continue;
    }
    for (const polygon of d.coordinates) {
      coordinates.push(polygon);
    }
  }
  return coordinates;
}

const units = [];
let skipped = 0;

for (const [sido, cities] of Object.entries(citiesBySido)) {
  for (const [city, gus] of Object.entries(cities)) {
    if (gus.length > 0) {
      for (const gu of gus) {
        const coordinates = collectCoords(sido, city, gu);
        if (coordinates.length === 0) {
          skipped += 1;
          continue;
        }
        units.push({
          key: `${city}/${gu}`,
          sido,
          label: gu,
          stampCity: city,
          type: 'MultiPolygon',
          coordinates,
        });
      }
      continue;
    }
    const coordinates = collectCoords(sido, city, null);
    if (coordinates.length === 0) {
      skipped += 1;
      continue;
    }
    units.push({
      key: city,
      sido,
      label: city,
      stampCity: city,
      type: 'MultiPolygon',
      coordinates,
    });
  }
}

writeFileSync(OUT, `${JSON.stringify({ units })}\n`);
const mb = (Buffer.byteLength(JSON.stringify({ units })) / 1e6).toFixed(2);
console.log(
  `wrote ${units.length} L1 units (${skipped} skipped empty) → ${OUT} (~${mb} MB)`,
);
