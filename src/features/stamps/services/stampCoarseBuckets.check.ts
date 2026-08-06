/**
 * Runnable check for stamp coarse thinning.
 * Run: npx tsx src/features/stamps/services/stampCoarseBuckets.check.ts
 */
import assert from 'node:assert/strict';

import type { PhotoRef } from '@/features/photos/types';

import {
  stampCoarseBucketKey,
  thinPhotosToCoarseBuckets,
} from './stampCoarseBuckets';

function photo(
  id: string,
  lat: number,
  lng: number,
  takenAt: string,
): PhotoRef {
  return { assetId: id, lat, lng, takenAt };
}

assert.equal(stampCoarseBucketKey(37.501, 127.002), '37.50,127.00');
assert.equal(stampCoarseBucketKey(37.509, 127.009), '37.51,127.01');

const a = photo('a', 37.501, 127.001, '2026-01-02T10:00:00.000Z');
const b = photo('b', 37.502, 127.002, '2026-01-01T10:00:00.000Z'); // earlier, same cell
const c = photo('c', 37.6, 127.1, '2026-01-03T10:00:00.000Z');

const thinned = thinPhotosToCoarseBuckets([a, b, c]);
assert.equal(thinned.length, 2);
assert.equal(thinned[0]?.assetId, 'b');
assert.equal(thinned[1]?.assetId, 'c');

console.log('stampCoarseBuckets.check.ts: ok');
