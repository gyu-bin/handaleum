/**
 * Runnable check: npx tsx src/features/cards/utils/rankSummaryTopPlaces.check.ts
 */
import assert from 'node:assert/strict';

import { rankSummaryTopPlaces } from './rankSummaryTopPlaces';

const ranked = rankSummaryTopPlaces(
  [
    { photoCount: 2, latestTakenAt: '2026-09-10T00:00:00.000Z', id: 'a' },
    { photoCount: 9, latestTakenAt: '2026-09-01T00:00:00.000Z', id: 'b' },
    { photoCount: 9, latestTakenAt: '2026-09-12T00:00:00.000Z', id: 'c' },
    { photoCount: 1, latestTakenAt: '2026-09-20T00:00:00.000Z', id: 'd' },
  ],
  3,
);

assert.deepEqual(
  ranked.map((r) => r.id),
  ['c', 'b', 'a'],
);
assert.deepEqual(rankSummaryTopPlaces([{ photoCount: 1, latestTakenAt: 'x' }], 0), []);

console.log('rankSummaryTopPlaces.check.ts: ok');
