/**
 * Runnable check for journey path mid-segment order numbers.
 * Run: npx tsx src/features/photos/utils/journeyPath.check.ts
 */
import assert from 'node:assert/strict';

import type { PlaceCluster } from '../types';
import { journeyPathCoords, journeyPathSteps } from './journeyPath';

function cluster(
  lat: number,
  lng: number,
  takenAt: string,
): PlaceCluster {
  return {
    id: `${lat},${lng}`,
    centerLat: lat,
    centerLng: lng,
    photos: [
      {
        assetId: takenAt,
        takenAt,
        lat,
        lng,
      },
    ],
  };
}

const a = cluster(37.5, 127.0, '2026-01-01T10:00:00.000Z');
const b = cluster(37.6, 127.1, '2026-01-02T10:00:00.000Z');
const c = cluster(37.7, 127.2, '2026-01-03T10:00:00.000Z');

assert.deepEqual(journeyPathSteps([]), []);
assert.deepEqual(journeyPathSteps([a]), []);

const coords = journeyPathCoords([c, a, b]);
assert.equal(coords.length, 3);
assert.equal(coords[0]?.latitude, a.centerLat);

const steps = journeyPathSteps([c, a, b]);
assert.equal(steps.length, 2);
assert.equal(steps[0]?.order, 2);
assert.equal(steps[1]?.order, 3);
assert.equal(
  steps[0]?.latitude,
  (a.centerLat + b.centerLat) / 2,
);

console.log('journeyPath.check: ok');
