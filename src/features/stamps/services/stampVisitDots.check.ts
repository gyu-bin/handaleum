/**
 * Runnable check for glance-map visit dots.
 * Run: npx tsx src/features/stamps/services/stampVisitDots.check.ts
 */
import assert from 'node:assert/strict';

import { resetDongLookupForTests } from './dongLookup';
import { visitDotsFromCollected } from './stampVisitDots';
import type { StampsCollected } from '../types';

resetDongLookupForTests();

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

const dots = visitDotsFromCollected(collected);
assert.equal(dots.length, 2);
const sajik = dots.find((d) => d.id === '서울/서울/사직동');
assert.ok(sajik);
assert.ok(sajik.lat > 37.5 && sajik.lat < 37.6);
assert.ok(sajik.lng > 126.9 && sajik.lng < 127.0);

console.log('stampVisitDots.check: ok', dots.map((d) => d.id).join(', '));
