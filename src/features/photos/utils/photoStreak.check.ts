/**
 * Runnable check for recap photo-day streaks.
 * Run: npx tsx src/features/photos/utils/photoStreak.check.ts
 */
import assert from 'node:assert/strict';

import {
  collectStreakDays,
  computePhotoStreak,
  dayKeyFromDate,
  dayKeysFromPhotos,
  photoStreakView,
  shiftDayKey,
  streakFlamePx,
  streakMilestone,
} from './photoStreak';

assert.equal(dayKeyFromDate(new Date(2026, 7, 21)), '2026-08-21');
assert.equal(shiftDayKey('2026-08-01', -1), '2026-07-31');
assert.equal(shiftDayKey('2026-08-31', 1), '2026-09-01');

const photos = [
  {
    assetId: 'a',
    takenAt: new Date(2026, 7, 10, 9, 0, 0).toISOString(),
    lat: 37.5,
    lng: 127.0,
  },
  {
    assetId: 'b',
    takenAt: new Date(2026, 7, 10, 18, 0, 0).toISOString(),
    lat: 37.5,
    lng: 127.0,
  },
  {
    assetId: 'c',
    takenAt: new Date(2026, 7, 11, 8, 0, 0).toISOString(),
    lat: 37.5,
    lng: 127.0,
  },
];
assert.deepEqual(dayKeysFromPhotos(photos), ['2026-08-10', '2026-08-11']);

const collected = collectStreakDays(
  { '2026-07': ['2026-07-30', '2026-07-31'], '2026-08': ['2026-08-01'] },
  '2026-08',
  ['2026-08-10', '2026-08-11'],
  '2026-08-01',
  '2026-08-21',
);
assert.deepEqual(collected, ['2026-08-10', '2026-08-11']);

const live12 = computePhotoStreak(
  [
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-13',
    '2026-08-14',
    '2026-08-15',
    '2026-08-16',
    '2026-08-17',
    '2026-08-18',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
  ],
  '2026-08-21',
);
assert.equal(live12.current, 12);
assert.equal(live12.best, 12);
assert.equal(photoStreakView(12, 12)?.kind, 'live');

const grace = computePhotoStreak(
  ['2026-08-19', '2026-08-20'],
  '2026-08-21',
);
assert.equal(grace.current, 2);
assert.equal(grace.best, 2);

const broken = computePhotoStreak(
  ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-10'],
  '2026-08-21',
);
assert.equal(broken.current, 0);
assert.equal(broken.best, 3);
assert.equal(photoStreakView(0, 3)?.kind, 'best');

const rebuilding = computePhotoStreak(
  [
    '2026-08-01',
    '2026-08-02',
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
    '2026-08-10',
    '2026-08-11',
    '2026-08-12',
    '2026-08-19',
    '2026-08-20',
    '2026-08-21',
  ],
  '2026-08-21',
);
assert.equal(rebuilding.current, 3);
assert.equal(rebuilding.best, 12);
assert.equal(photoStreakView(3, 12)?.kind, 'liveBest');

assert.equal(photoStreakView(1, 1), null);
assert.equal(photoStreakView(0, 1), null);
assert.equal(photoStreakView(0, 0), null);

assert.equal(streakFlamePx(9), 0);
assert.equal(streakFlamePx(10), 28);
assert.equal(streakFlamePx(19), 28);
assert.equal(streakFlamePx(20), 36);
assert.equal(streakFlamePx(30), 44);
assert.equal(streakFlamePx(99), 44);

assert.equal(streakMilestone(9), 0);
assert.equal(streakMilestone(10), 10);
assert.equal(streakMilestone(16), 10);
assert.equal(streakMilestone(20), 20);
assert.equal(streakMilestone(29), 20);
assert.equal(streakMilestone(30), 30);

console.log('photoStreak.check: ok');
