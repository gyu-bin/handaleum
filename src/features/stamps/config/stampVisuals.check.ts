import assert from 'node:assert/strict';

import {
  romanizeStampName,
  stampInkForState,
  stampSymbolFor,
  stampVariationFor,
} from './stampVisuals';

assert.equal(stampSymbolFor('서울', '서울', 'sido'), 'landmark');
assert.equal(stampSymbolFor('서울/용산구', '용산구', 'district'), 'landmark');
assert.equal(
  stampSymbolFor('서울/마포구', '마포구', 'district'),
  'bridge',
);
assert.equal(
  stampSymbolFor('서울/서울/이태원동', '이태원동', 'neighborhood'),
  'street',
);
assert.equal(
  stampSymbolFor('서울/서울/한남동', '한남동', 'neighborhood'),
  'cafe',
);
assert.equal(
  stampSymbolFor('서울/서울/후암동', '후암동', 'neighborhood'),
  'mountain',
);

const unknownA = stampSymbolFor('서울/서울/알수없는동', '알수없는동', 'neighborhood');
const unknownB = stampSymbolFor('서울/서울/알수없는동', '알수없는동', 'neighborhood');
assert.equal(unknownA, unknownB);
assert.notEqual(
  stampSymbolFor('서울/서울/알수없는동', '알수없는동', 'neighborhood'),
  stampSymbolFor('서울/서울/또다른미지동', '또다른미지동', 'neighborhood'),
);

const a = stampVariationFor('서울/서울/이태원동');
const b = stampVariationFor('서울/서울/이태원동');
assert.deepEqual(a, b);
assert.notDeepEqual(
  stampVariationFor('서울/서울/한남동'),
  stampVariationFor('서울/서울/이태원동'),
);

assert.equal(romanizeStampName('이태원동').length > 0, true);
assert.equal(romanizeStampName('이태원동'), romanizeStampName('이태원동'));

assert.equal(stampInkForState(true), stampInkForState(true));
assert.equal(stampInkForState(false), stampInkForState(false));
assert.notEqual(stampInkForState(true), stampInkForState(false));

console.log('stampVisuals.check: ok');
