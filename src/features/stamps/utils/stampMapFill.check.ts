/**
 * Self-check: stamp map fill palette is stable per key.
 * Run: npx tsx src/features/stamps/utils/stampMapFill.check.ts
 */
import assert from 'node:assert/strict';

import { stampMapFill } from './stampMapFill';

const a = stampMapFill('서울');
const b = stampMapFill('서울');
assert.equal(a, b, 'same key → same fill');
assert.ok(a.startsWith('rgba('), `expected rgba fill, got ${a}`);

const sidos = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];
const unique = new Set(sidos.map(stampMapFill));
assert.ok(
  unique.size >= 6,
  `expected several fills across sidos, got ${unique.size}`,
);

console.log('stampMapFill.check: ok');
