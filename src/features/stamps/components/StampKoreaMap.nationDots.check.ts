/**
 * Self-check: nation visit dots get finite screen coords for every 시·도.
 * Run: npx tsx src/features/stamps/components/StampKoreaMap.nationDots.check.ts
 */
import assert from 'node:assert/strict';

import {
  bboxOf,
  centroidOf,
  createProjection,
} from '@/features/photos/utils/geo';

import { getStampMapProvinces } from '../services/stampMapIndex';

const provinces = getStampMapProvinces();
assert.ok(provinces.length >= 17, `expected ≥17 provinces, got ${provinces.length}`);

const korea = provinces.reduce(
  (acc, p) => {
    const b = bboxOf(p.geometry);
    return {
      minLng: Math.min(acc.minLng, b.minLng),
      maxLng: Math.max(acc.maxLng, b.maxLng),
      minLat: Math.min(acc.minLat, b.minLat),
      maxLat: Math.max(acc.maxLat, b.maxLat),
    };
  },
  {
    minLng: Infinity,
    maxLng: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
  },
);

const projection = createProjection(korea, 300, 420, 20);
for (const p of provinces) {
  const [lng, lat] = centroidOf(p.geometry);
  const [cx, cy] = projection.project([lng, lat]);
  assert.ok(Number.isFinite(cx) && Number.isFinite(cy), `${p.name} centroid`);
}

console.log('StampKoreaMap.nationDots.check: ok');
