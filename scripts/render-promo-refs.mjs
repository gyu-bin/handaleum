/**
 * Render South Korea map / brand-mark reference PNGs for promo regeneration.
 * Uses the same geo + FOCUS_BBOX as PaperMap (Republic of Korea only).
 *
 * Run: node scripts/render-promo-refs.mjs
 * ponytail: one-off promo refs; delete after regen if unused.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets/promo');

const FOCUS_BBOX = {
  minLng: 125.75,
  maxLng: 129.6,
  minLat: 33.08,
  maxLat: 38.62,
};

const COLORS = {
  water: '#CBE0EF',
  land: '#F2EDE4',
  border: '#D5DCE2',
  ink: '#33475B',
};

const KOREA_SILHOUETTE = {
  viewBox: '0 0 51.9 100.0',
  path:
    'M40.6,65.0 42.5,64.7 42.7,65.9 44.1,64.4 45.0,64.8 47.1,60.8 48.5,60.1 48.2,57.9 48.8,56.9 49.7,57.7 49.7,54.6 51.9,47.3 51.3,46.6 49.8,48.4 48.8,47.3 49.7,46.4 48.7,43.5 50.3,34.0 48.5,25.4 45.0,20.7 44.0,17.3 37.3,8.5 33.3,0.0 32.5,3.2 28.3,6.2 25.0,4.9 20.7,5.8 19.0,5.1 15.2,5.5 13.0,7.1 12.8,8.7 11.2,9.3 10.6,11.1 8.4,12.2 8.2,15.3 6.1,15.2 6.3,17.6 7.5,18.6 6.9,18.9 7.9,20.4 7.2,21.7 8.1,23.2 7.0,23.3 9.6,22.0 6.6,24.6 6.5,25.9 8.1,26.1 7.0,24.3 7.5,24.0 10.5,24.2 10.1,25.2 8.0,24.6 8.0,26.3 11.9,31.7 10.7,31.8 10.0,30.2 5.8,28.5 5.1,29.8 3.2,29.9 4.8,31.6 3.8,32.8 3.3,32.3 2.6,33.4 2.8,30.2 2.6,31.5 1.0,31.8 1.1,33.2 0.7,32.6 0.0,33.9 0.1,35.1 0.4,34.3 1.6,34.9 0.6,35.7 2.3,34.7 2.7,37.4 3.8,36.6 5.1,37.2 6.3,40.1 5.5,41.1 6.7,41.7 5.8,42.2 6.5,43.3 5.7,45.7 8.0,46.6 8.3,48.1 9.6,48.0 6.2,48.7 4.9,51.4 7.2,49.2 8.9,52.0 7.8,51.9 6.8,53.9 5.5,51.7 6.6,53.8 5.3,55.5 8.3,56.1 5.5,57.1 2.9,62.0 5.1,65.3 4.3,66.2 3.3,64.9 3.5,63.7 0.7,65.0 1.8,66.3 3.1,65.0 4.1,66.0 2.7,67.3 3.8,68.1 4.0,66.9 4.5,69.6 3.5,70.4 5.0,70.7 4.0,70.9 3.7,72.3 2.6,71.1 2.1,72.8 3.0,74.6 5.1,75.2 6.2,79.7 9.1,76.9 10.0,74.1 10.1,76.5 12.2,76.9 13.0,73.5 16.9,71.1 18.4,72.0 18.0,72.9 17.0,72.0 14.9,75.0 18.3,76.9 19.6,75.7 19.3,74.2 20.8,74.0 18.9,71.7 19.5,70.1 18.8,69.7 20.9,69.0 22.1,71.2 21.5,73.0 22.6,73.4 23.1,71.2 24.6,71.4 24.8,69.2 22.8,69.8 21.9,68.1 22.8,68.8 24.6,67.3 26.4,67.6 27.1,66.4 28.3,67.0 28.1,65.8 29.0,65.2 29.0,67.9 31.2,68.6 31.2,67.8 32.6,68.3 33.0,67.4 33.5,68.4 32.7,68.5 34.3,69.8 35.3,68.8 34.8,68.3 34.5,69.0 34.3,66.8 35.7,66.3 35.3,65.3 33.8,66.4 33.8,65.7 36.2,64.5 36.8,65.7 37.7,65.3 37.0,62.8 37.4,64.1 40.7,65.2 40.5,66.8 40.6,65.0ZM11.8,94.1 9.7,93.1 3.0,94.9 0.7,98.3 2.4,100.0 3.3,99.1 9.4,98.5 12.3,95.7 11.8,94.1Z',
};

function mercatorY(lat) {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function bboxOf(geometry) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  return { minLng, maxLng, minLat, maxLat };
}

function createProjection(bbox, width, height, pad = 36) {
  const x0 = (bbox.minLng * Math.PI) / 180;
  const x1 = (bbox.maxLng * Math.PI) / 180;
  const y0 = mercatorY(bbox.minLat);
  const y1 = mercatorY(bbox.maxLat);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const scale = Math.min(
    innerW / Math.max(1e-9, x1 - x0),
    innerH / Math.max(1e-9, y1 - y0),
  );
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return {
    project([lng, lat]) {
      const x = pad + innerW / 2 + ((lng * Math.PI) / 180 - cx) * scale;
      const y = pad + innerH / 2 - (mercatorY(lat) - cy) * scale;
      return [x, y];
    },
  };
}

function geometryToPath(geometry, project) {
  const parts = [];
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      if (!ring.length) continue;
      ring.forEach(([lng, lat], index) => {
        const [x, y] = project([lng, lat]);
        parts.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
      });
      parts.push('Z');
    }
  }
  return parts.join(' ');
}

function focusedBbox(korea) {
  const raw = bboxOf(korea);
  return {
    minLng: Math.max(raw.minLng, FOCUS_BBOX.minLng),
    maxLng: Math.min(raw.maxLng, FOCUS_BBOX.maxLng),
    minLat: Math.max(raw.minLat, FOCUS_BBOX.minLat),
    maxLat: Math.min(raw.maxLat, FOCUS_BBOX.maxLat),
  };
}

function mapSvg(width, height) {
  const koreaGeo = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'assets/geo/korea.json'), 'utf8'),
  );
  const provincesGeo = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'assets/geo/provinces.json'), 'utf8'),
  );
  const korea = koreaGeo.korea;
  const bbox = focusedBbox(korea);
  const projection = createProjection(bbox, width, height, 24);
  const koreaPath = geometryToPath(korea, projection.project);
  const provincePaths = provincesGeo.provinces
    .map((p) => geometryToPath(p, projection.project))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${COLORS.water}"/>
  <path d="${koreaPath}" fill="${COLORS.land}" stroke="${COLORS.border}" stroke-width="1.2" stroke-linejoin="round"/>
  ${provincesGeo.provinces
    .map(
      (_, i) =>
        `<path d="${geometryToPath(provincesGeo.provinces[i], projection.project)}" fill="none" stroke="${COLORS.border}" stroke-opacity="0.55" stroke-width="0.7"/>`,
    )
    .join('\n  ')}
</svg>`;
}

function markSvg(size) {
  const h = size;
  const w = size * 0.519;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${KOREA_SILHOUETTE.viewBox}">
  <path d="${KOREA_SILHOUETTE.path}" fill="${COLORS.ink}"/>
</svg>`;
}

async function main() {
  const sharp = (await import('sharp')).default;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const mapPng = path.join(OUT_DIR, '_ref-south-korea-map.png');
  const markPng = path.join(OUT_DIR, '_ref-south-korea-mark.png');

  await sharp(Buffer.from(mapSvg(900, 1100))).png().toFile(mapPng);
  await sharp(Buffer.from(markSvg(400))).png().toFile(markPng);

  console.log('Wrote', mapPng);
  console.log('Wrote', markPng);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
