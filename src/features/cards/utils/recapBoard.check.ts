/**
 * Runnable check for recap board day snake + local-day grouping.
 * Run: npx tsx src/features/cards/utils/recapBoard.check.ts
 */
import assert from 'node:assert/strict';

import type { PhotoRef } from '../../photos/types';
import {
  applyPlaceAliases,
  daysInMonth,
  groupPhotosByPlaceDay,
  localDayKey,
  recapDayCalendarNodes,
  recapDayNodes,
  recapDayPhotos,
  recapBoardPages,
  resolveRecapCoverAssetId,
  monthStartWeekday,
  chunkRows,
  placeIdentityFromVisitNodeId,
  placeVisitNodeId,
  snakeCell,
  snakeRailPath,
  snakeRows,
} from './recapBoard';

assert.equal(daysInMonth('2026-08'), 31);
assert.equal(daysInMonth('2026-02'), 28);
assert.equal(daysInMonth('2024-02'), 29);

assert.equal(localDayKey('2026-08-06T03:00:00.000Z').length, 10);

const photos: PhotoRef[] = [
  {
    assetId: 'a',
    takenAt: new Date(2026, 7, 6, 10, 0, 0).toISOString(),
    lat: 35.8,
    lng: 127.1,
  },
  {
    assetId: 'b',
    takenAt: new Date(2026, 7, 6, 15, 0, 0).toISOString(),
    lat: 35.81,
    lng: 127.12,
  },
  {
    assetId: 'c',
    takenAt: new Date(2026, 7, 16, 9, 0, 0).toISOString(),
    lat: 35.6,
    lng: 126.5,
  },
];

const days = recapDayNodes('2026-08', photos);
assert.equal(days.length, 31);
assert.equal(days[5]?.label, '6');
assert.equal(days[5]?.photoCount, 2);
assert.equal(days[5]?.assetId, 'a');
assert.equal(days[15]?.photoCount, 1);
assert.equal(days[0]?.assetId, null);

assert.equal(monthStartWeekday('2026-08'), 6);
const cal = recapDayCalendarNodes('2026-08', photos);
assert.equal(cal.length % 7, 0);
assert.equal(cal[6]?.label, '1');
assert.equal(cal[6]?.blank, undefined);
assert.equal(cal[0]?.blank, true);
assert.equal(cal[11]?.label, '6');
assert.equal(cal[11]?.photoCount, 2);
assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 3), [[1, 2, 3], [4, 5]]);

const rows = snakeRows([1, 2, 3, 4, 5, 6, 7], 3);
assert.deepEqual(rows, [
  [1, 2, 3],
  [6, 5, 4],
  [7],
]);

assert.deepEqual(snakeCell(0, 3), { row: 0, col: 0 });
assert.deepEqual(snakeCell(2, 3), { row: 0, col: 2 });
assert.deepEqual(snakeCell(3, 3), { row: 1, col: 2 });
assert.deepEqual(snakeCell(5, 3), { row: 1, col: 0 });
assert.deepEqual(snakeCell(6, 3), { row: 2, col: 0 });

const rail = snakeRailPath(3, 3, 100, 80, 20);
assert.equal(rail.startsWith('M 50 20'), true);
assert.equal(rail.includes('L 150 20'), true);
assert.equal(snakeRailPath(1, 3, 100, 80, 20), '');
const gapped = snakeRailPath(2, 2, 100, 80, 20, 16);
assert.equal(gapped.startsWith('M 50 20'), true);
assert.equal(gapped.includes('L 166 20'), true);

assert.deepEqual(recapBoardPages([1, 2, 3, 4, 5], 2, 2), [
  [1, 2, 3, 4],
  [5],
]);
assert.deepEqual(recapBoardPages([], 4, 3), []);

const aliased = applyPlaceAliases(
  [
    { id: '전주|풍남동@2026-08-06', label: '전주 풍남동', assetId: 'a', photoCount: 2 },
    { id: '전주|풍남동@2026-08-16', label: '전주 풍남동', assetId: 'c', photoCount: 1 },
    { id: 'pending:1', label: '', assetId: 'b', photoCount: 1 },
  ],
  { '전주|풍남동': '한옥마을', leftover: 'x' },
);
assert.equal(aliased[0]?.label, '한옥마을');
assert.equal(aliased[1]?.label, '한옥마을');
assert.equal(aliased[2]?.label, '');

assert.deepEqual(
  recapDayPhotos('2026-08-06', photos).map((p) => p.assetId),
  ['a', 'b'],
);
assert.equal(recapDayPhotos('2026-08-01', photos).length, 0);

assert.equal(
  resolveRecapCoverAssetId('2026-08-06', ['a', 'b'], { '2026-08-06': 'b' }, null),
  'b',
);
assert.equal(
  resolveRecapCoverAssetId('2026-08-06', ['a', 'b'], {}, 'b'),
  'b',
);
assert.equal(
  resolveRecapCoverAssetId('2026-08-06', ['a', 'b'], { '2026-08-06': 'z' }, null),
  'a',
);
assert.equal(resolveRecapCoverAssetId('x', [], {}, null), null);

assert.equal(
  placeIdentityFromVisitNodeId(placeVisitNodeId('전주|풍남동', '2026-08-06')),
  '전주|풍남동',
);
assert.equal(placeIdentityFromVisitNodeId('전주|풍남동'), '전주|풍남동');

const sameSpot = (day: number, hour: number, id: string): PhotoRef => ({
  assetId: id,
  takenAt: new Date(2026, 7, day, hour, 0, 0).toISOString(),
  lat: 35.8,
  lng: 127.1,
});
const byPlace = groupPhotosByPlaceDay(
  [sameSpot(6, 10, 'a'), sameSpot(6, 15, 'b'), sameSpot(16, 9, 'c')],
  () => '전주|풍남동',
);
assert.equal(byPlace.length, 2);
assert.deepEqual(
  byPlace[0]?.photos.map((photo) => photo.assetId),
  ['a', 'b'],
);
assert.deepEqual(
  byPlace[1]?.photos.map((photo) => photo.assetId),
  ['c'],
);
assert.equal(
  placeIdentityFromVisitNodeId(byPlace[0]!.id),
  placeIdentityFromVisitNodeId(byPlace[1]!.id),
);
assert.notEqual(byPlace[0]?.id, byPlace[1]?.id);

console.log('ok recapBoard');
