/**
 * Self-check: stamp map L1 units + selection helpers.
 * Run: npx tsx src/features/stamps/services/stampMapIndex.check.ts
 */
import assert from 'node:assert/strict';

import {
  getStampMapUnits,
  selectionFromProvince,
  selectionFromUnit,
  visitedL1Keys,
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
assert.ok(visited.has('서울/종로구'), '사직동 → 종로구');
assert.ok(visited.has('가평군'), '가평읍 → 가평군');
assert.equal(visited.has('서울/강남구'), false);

assert.deepEqual(selectionFromProvince('부산'), { sido: '부산', l1Key: null });
assert.deepEqual(selectionFromUnit(gapyeong), {
  sido: '경기',
  l1Key: '가평군',
});

console.log('stampMapIndex.check: ok');
