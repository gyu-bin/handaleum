/**
 * Runnable check for collage place-chip grain.
 * Run: npx tsx src/features/cards/utils/cardPlaceChip.check.ts
 */
import assert from 'node:assert/strict';

import { cardPhotoPlaceChip } from './cardPlaceChip';

assert.equal(
  cardPhotoPlaceChip({ gu: '강남구', city: '서울', province: '서울' }),
  '강남구',
);
assert.equal(
  cardPhotoPlaceChip({ gu: null, city: '가평군', province: '경기' }),
  '가평군',
);
assert.equal(
  cardPhotoPlaceChip({ gu: null, city: null, province: '제주' }),
  '제주',
);
assert.equal(
  cardPhotoPlaceChip({ gu: null, city: null, province: null }),
  null,
);

console.log('cardPlaceChip.check ok');
