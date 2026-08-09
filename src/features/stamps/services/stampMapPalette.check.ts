/**
 * Stamp glance wash palette / legend grouping.
 * Run: npx tsx src/features/stamps/services/stampMapPalette.check.ts
 */
import assert from 'node:assert/strict';

import {
  stampBlobFillForSido,
  stampMapLegendFromCollected,
  stampWashRegionForSido,
} from './stampMapPalette';
import type { StampsCollected } from '../types';

assert.equal(stampWashRegionForSido('서울')?.id, 'capital');
assert.equal(stampWashRegionForSido('제주')?.id, 'jeju');
assert.ok(stampBlobFillForSido('강원').length > 0);

const collected: StampsCollected = {
  '서울/서울/이태원1동': {
    name: '이태원1동',
    city: '서울',
    sido: '서울',
    firstMonth: '2026-08',
  },
  '제주/제주시/이도2동': {
    name: '이도2동',
    city: '제주시',
    sido: '제주',
    firstMonth: '2026-08',
  },
};

const legend = stampMapLegendFromCollected(collected);
assert.equal(legend.length, 2);
assert.equal(legend[0]?.id, 'capital');
assert.equal(legend[1]?.id, 'jeju');

console.log('stampMapPalette.check.ts: ok');
