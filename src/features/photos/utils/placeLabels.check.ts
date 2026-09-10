/**
 * Runnable check: landmark bboxes + city+구+동 fine labels.
 * Run: npx tsx src/features/photos/utils/placeLabels.check.ts
 */
import assert from 'node:assert/strict';

import { composeFineLabel } from './placeLabels';

assert.equal(
  composeFineLabel('서울', '종로구', '세종로', {
    lat: 37.576,
    lng: 126.9769,
  }),
  '광화문',
  'Gwanghwamun plaza should nickname even with a dong',
);

assert.equal(
  composeFineLabel('서울', null, null, {
    lat: 37.576,
    lng: 126.9769,
  }),
  '광화문',
  'Gwanghwamun should win over city-only geocode',
);

assert.equal(
  composeFineLabel('서울', '종로구', '사직동', {
    lat: 37.576,
    lng: 126.968,
  }),
  '서울 종로구 사직동',
  'non-landmark should keep city+구+동',
);

assert.equal(
  composeFineLabel('서울', '강남구', '신사동', {
    lat: 37.5215,
    lng: 127.023,
  }),
  '가로수길',
);

assert.equal(
  composeFineLabel('서울', '강남구', '신사동', {
    lat: 37.53,
    lng: 127.03,
  }),
  '신사동',
  '신사동 outside corridor is not 가로수길',
);

console.log('placeLabels.check.ts: ok');
