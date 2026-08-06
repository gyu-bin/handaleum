/**
 * Runnable check for stamp L1/L2 navigation index.
 * Run: npx tsx src/features/stamps/services/stampNavIndex.check.ts
 */
import assert from 'node:assert/strict';

import {
  findL1ForStamp,
  guForDong,
  l1UnitsForSido,
  l2LeavesForUnit,
} from './stampNavIndex';

const seoulL1 = l1UnitsForSido('서울');
assert.equal(seoulL1.length, 25, '서울 L1 = 25 구');
assert.ok(seoulL1.every((u) => u.kind === 'gu'));

const gangnam = seoulL1.find((u) => u.label === '강남구');
assert.ok(gangnam);
const gangnamLeaves = l2LeavesForUnit('서울', gangnam);
assert.ok(gangnamLeaves.length > 10, '강남구 has dongs');
assert.ok(gangnamLeaves.includes('역삼1동'));
assert.equal(guForDong('서울', '역삼1동'), '강남구');

const allSeoulLeaves = seoulL1.flatMap((u) => l2LeavesForUnit('서울', u));
assert.equal(allSeoulLeaves.length, 425, '서울 L2 partition covers all dongs');

const gg = l1UnitsForSido('경기');
assert.ok(!gg.some((u) => u.label === '수원시'), '수원시 not L1 (구 only)');
assert.ok(gg.some((u) => u.label === '영통구' && u.stampCity === '수원시'));
assert.ok(gg.some((u) => u.kind === 'gun' && u.label === '가평군'));

const gapyeong = gg.find((u) => u.label === '가평군')!;
const gunLeaves = l2LeavesForUnit('경기', gapyeong);
assert.ok(gunLeaves.includes('가평읍'));
assert.ok(gunLeaves.includes('설악면'));
assert.ok(gunLeaves.every((n) => n.endsWith('면') || n.endsWith('읍')));
assert.equal(gunLeaves.length, 6, '가평군 atlas leaves');

const busan = l1UnitsForSido('부산');
assert.ok(busan.some((u) => u.kind === 'gun' && u.label === '기장군'));
assert.ok(busan.some((u) => u.kind === 'gu' && u.label === '해운대구'));

const nav = findL1ForStamp('서울', '서울', '역삼1동');
assert.equal(nav?.key, '서울/강남구');

console.log('stampNavIndex.check.ts: ok');
