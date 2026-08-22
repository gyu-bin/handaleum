/**
 * Self-check: L1 city list sort (많은순 / 적은순 / 가나다).
 * Run: npx tsx src/features/stamps/services/stampCitySort.check.ts
 */
import assert from 'node:assert/strict';

import { sortCityRows } from './stampNavIndex';

const rows = [
  { label: '강북구', collected: 3 },
  { label: '강남구', collected: 11 },
  { label: '마포구', collected: 0 },
  { label: '서초구', collected: 11 },
];

assert.deepEqual(
  sortCityRows(rows, 'most').map((r) => r.label),
  ['강남구', '서초구', '강북구', '마포구'],
);
assert.deepEqual(
  sortCityRows(rows, 'least').map((r) => r.label),
  ['마포구', '강북구', '강남구', '서초구'],
);
assert.deepEqual(
  sortCityRows(rows, 'name').map((r) => r.label),
  ['강남구', '강북구', '마포구', '서초구'],
);

console.log('stampCitySort.check ok');
