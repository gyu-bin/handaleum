/**
 * Pure fixture contract check (no react-native import).
 * Run: node_modules/.bin/jiti src/features/photos/services/dummyNoGpsFixture.check.ts
 */
import assert from 'node:assert/strict';

import { getAllMonthlyPhotos, isLocatedPhoto } from '../utils/monthlyPhotoDisplay';
import type { MonthKey, MonthlyPhotos, NoLocationPhoto, PhotoRef } from '../types';

/** Mirrors buildMixedMonthFixture peel indices in dummyPhotos.ts */
function synthesizeMixed(month: MonthKey): MonthlyPhotos {
  const photos: PhotoRef[] = [];
  for (let i = 0; i < 41; i += 1) {
    photos.push({
      assetId: `dummy:${month}:${i}`,
      takenAt: new Date(2026, 8, 17, 10, i, 0).toISOString(),
      lat: 37.5,
      lng: 127,
    });
  }
  const year = 2026;
  const monthIndex = 8;
  const day12GpsIds = new Set([0, 1, 2].map((i) => photos[i]!.assetId));
  const day12NoLocIds = new Set([3, 4, 5, 6].map((i) => photos[i]!.assetId));
  const day15GpsIds = new Set([7, 8, 9, 10, 11].map((i) => photos[i]!.assetId));
  for (let i = 0; i < 3; i += 1) {
    photos[i]!.takenAt = new Date(year, monthIndex, 12, 10 + i, 10).toISOString();
  }
  for (let i = 3; i < 7; i += 1) {
    photos[i]!.takenAt = new Date(year, monthIndex, 12, 14 + (i - 3), 20).toISOString();
  }
  for (let i = 7; i < 12; i += 1) {
    photos[i]!.takenAt = new Date(year, monthIndex, 15, 10 + (i - 7), 30).toISOString();
  }
  const peel = new Set([3, 4, 5, 6, 12, 13, 14, 15, 16, 17, 18]);
  const located: PhotoRef[] = [];
  const noLocationPhotos: NoLocationPhoto[] = [];
  photos.forEach((photo, index) => {
    if (peel.has(index)) {
      noLocationPhotos.push({ assetId: photo.assetId, takenAt: photo.takenAt });
    } else {
      located.push(photo);
    }
  });

  const fillDays: number[] = [];
  for (let d = 1; d <= 30; d += 1) {
    if (d !== 12 && d !== 15) {
      fillDays.push(d);
    }
  }
  let fill = 0;
  for (const photo of located) {
    if (day12GpsIds.has(photo.assetId) || day15GpsIds.has(photo.assetId)) {
      continue;
    }
    const day = fillDays[fill % fillDays.length]!;
    photo.takenAt = new Date(2026, 8, day, 11, fill % 60).toISOString();
    fill += 1;
  }
  fill = 0;
  for (const photo of noLocationPhotos) {
    if (day12NoLocIds.has(photo.assetId)) {
      continue;
    }
    const day = fillDays[fill % fillDays.length]!;
    photo.takenAt = new Date(2026, 8, day, 15, fill % 60).toISOString();
    fill += 1;
  }

  return {
    month,
    photos: located,
    noLocationCount: noLocationPhotos.length,
    noLocationPhotos,
  };
}

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const mixed = synthesizeMixed('2026-09');
assert.equal(mixed.photos.length, 30);
assert.equal(mixed.noLocationPhotos.length, 11);
const display = getAllMonthlyPhotos(mixed);
assert.equal(display.length, 41);

const d12 = display.filter((p) => localDayKey(p.takenAt) === '2026-09-12');
const d15 = display.filter((p) => localDayKey(p.takenAt) === '2026-09-15');
assert.equal(d12.length, 7);
assert.equal(d12.filter(isLocatedPhoto).length, 3);
assert.equal(d12.filter((p) => !isLocatedPhoto(p)).length, 4);
assert.equal(d15.length, 5);
assert.equal(d15.every(isLocatedPhoto), true);

const byDay = new Map<string, number>();
for (const p of display) {
  const k = localDayKey(p.takenAt);
  byDay.set(k, (byDay.get(k) ?? 0) + 1);
}
let busiest = { date: '', count: 0 };
for (const [date, count] of byDay) {
  if (count > busiest.count) {
    busiest = { date, count };
  }
}
assert.equal(busiest.date, '2026-09-12');
assert.equal(busiest.count, 7);

console.log('dummyNoGpsFixture.check ok');
