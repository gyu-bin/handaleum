/**
 * Run: npx tsx src/features/photos/utils/pickMemoryDay.check.ts
 */
import assert from 'node:assert/strict';

import type { PhotoRef } from '../types';
import {
  clampDayAwayFromMonthEnd,
  isNearMonthEnd,
  pickMemoryDay,
  photosInMonth,
} from './pickMemoryDay';

function photo(
  assetId: string,
  takenAt: string,
  lat: number,
  lng: number,
): PhotoRef {
  return { assetId, takenAt, lat, lng };
}

assert.equal(isNearMonthEnd(29, 31), true);
assert.equal(isNearMonthEnd(30, 31), true);
assert.equal(isNearMonthEnd(31, 31), true);
assert.equal(isNearMonthEnd(28, 31), false);
assert.equal(clampDayAwayFromMonthEnd(31, 31), 28);
assert.equal(clampDayAwayFromMonthEnd(12, 31), 12);

const month = '2025-09' as const;
const photos = [
  photo('a', '2025-09-05T12:00:00.000+09:00', 37.5, 127.0),
  photo('b', '2025-09-12T12:00:00.000+09:00', 37.5, 127.0),
  photo('c', '2025-09-12T14:00:00.000+09:00', 37.5, 127.0),
  photo('d', '2025-09-12T15:00:00.000+09:00', 37.6, 127.1),
  photo('e', '2025-09-30T12:00:00.000+09:00', 37.7, 127.2),
];

assert.equal(photosInMonth(photos, month).length, 5);
assert.equal(photosInMonth(photos, '2025-08').length, 0);

const stampIdOf = (lat: number, lng: number): string | null => {
  if (lat === 37.6 && lng === 127.1) {
    return '서울/성동구/성수동';
  }
  if (lat === 37.7 && lng === 127.2) {
    return '서울/종로구/청운동';
  }
  return '서울/강남구/역삼동';
};

const newDong = pickMemoryDay(
  month,
  photos,
  [{ id: '서울/성동구/성수동', name: '성수동' }],
  stampIdOf,
);
assert.ok(newDong);
assert.equal(newDong!.kind, 'newDong');
assert.equal(newDong!.day, 12);
assert.equal(newDong!.dongName, '성수동');
assert.equal(newDong!.assetId, 'd');

const most = pickMemoryDay(month, photos, [], stampIdOf);
assert.ok(most);
assert.equal(most!.kind, 'mostPhotos');
assert.equal(most!.day, 12);
assert.equal(most!.assetId, 'b');

const onlyEnd = pickMemoryDay(
  month,
  [photo('z', '2025-09-30T12:00:00.000+09:00', 37.5, 127.0)],
  [],
  () => '서울/강남구/역삼동',
);
assert.ok(onlyEnd);
assert.equal(onlyEnd!.kind, 'fallback');
assert.equal(onlyEnd!.day, 30);

console.log('pickMemoryDay.check: ok');
