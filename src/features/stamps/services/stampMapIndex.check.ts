/**
 * Self-check: stamp map L1 units + selection helpers.
 * Run: npx tsx src/features/stamps/services/stampMapIndex.check.ts
 */
import assert from 'node:assert/strict';

import {
  countVisitedDongsInSido,
  countVisitedL1InSido,
  getStampMapUnits,
  mapVisitKey,
  selectionFromProvince,
  selectionFromUnit,
  unitsForSido,
  visitedL1Keys,
  visitedSidoNames,
} from './stampMapIndex';
import type { StampsCollected } from '../types';

const units = getStampMapUnits();
assert.ok(units.length >= 200, `expected many L1 units, got ${units.length}`);

const gangnam = units.find((u) => u.key === '서울/강남구');
assert.ok(gangnam, '서울/강남구 unit missing');
assert.ok(gangnam.geometry.coordinates.length > 0);

const gapyeong = units.find((u) => u.key === '가평군');
assert.ok(gapyeong, '가평군 unit missing');
assert.equal(gapyeong.sido, '경기');

const collected: StampsCollected = {
  '서울/서울/사직동': {
    name: '사직동',
    city: '서울',
    sido: '서울',
    firstMonth: '2026-03',
  },
  '경기/가평군/가평읍': {
    name: '가평읍',
    city: '가평군',
    sido: '경기',
    firstMonth: '2026-04',
  },
};

const visited = visitedL1Keys(collected);
assert.ok(visited.has('서울/서울/종로구'), '사직동 → 서울/종로구');
assert.ok(visited.has('경기/가평군'), '가평읍 → 가평군');
assert.equal(visited.has('서울/서울/강남구'), false);

const goseongs = units.filter((u) => u.key === '고성군');
assert.equal(goseongs.length, 2, '강원·경남 고성군');
assert.equal(
  new Set(goseongs.map((u) => mapVisitKey(u.sido, u.key))).size,
  2,
  '고성군 map keys must be unique per sido',
);
assert.deepEqual(
  goseongs.map((u) => u.label).sort(),
  ['강원 고성군', '경남 고성군'],
);

assert.deepEqual(selectionFromProvince('부산'), { sido: '부산', l1Key: null });
assert.deepEqual(selectionFromUnit(gapyeong), {
  sido: '경기',
  l1Key: '가평군',
});

const sidos = visitedSidoNames(collected);
assert.ok(sidos.has('서울') && sidos.has('경기'));
assert.equal(sidos.size, 2);
assert.equal(countVisitedDongsInSido(collected, '서울'), 1);
assert.equal(countVisitedL1InSido(collected, '서울'), 1);
assert.ok(unitsForSido('서울').length >= 20);

console.log('stampMapIndex.check: ok');
