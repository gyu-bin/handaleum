/**
 * Runnable check for offline dong PIP lookup.
 * Run: npx tsx src/features/stamps/services/dongLookup.check.ts
 */
import assert from 'node:assert/strict';

import { lookupDong, resetDongLookupForTests } from './dongLookup';

resetDongLookupForTests();

const hit = lookupDong(37.50192727272727, 127.03861818181818);
assert.ok(hit, '역삼1동 sample point should resolve');
assert.equal(hit.sido, '서울');
assert.equal(hit.city, '서울');
assert.ok(
  hit.name.includes('역삼'),
  `expected 역삼* dong, got ${hit.name}`,
);

const gun = lookupDong(37.66038859649124, 127.50100438596492);
assert.ok(gun, '가평 설악면 sample should resolve');
assert.equal(gun.sido, '경기');
assert.equal(gun.city, '가평군');
assert.equal(gun.name, '설악면');

const gijang = lookupDong(35.284768, 129.1544013333333);
assert.ok(gijang, '기장 철마면 sample should resolve');
assert.equal(gijang.city, '기장군');
assert.equal(gijang.name, '철마면');

const sea = lookupDong(35.0, 130.0);
assert.equal(sea, null, 'open water should miss');

console.log('dongLookup.check.ts: ok', hit.name, gun.name, gijang.name);
