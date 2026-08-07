/**
 * Self-check: admin tokenizer must not treat 압구 as a 구.
 * Run: npx tsx src/features/photos/utils/adminTokens.check.ts
 */
import assert from 'node:assert/strict';

import { tokenizeAdminText } from './adminTokens';
import { composeFineLabel } from './placeLabels';
import { parseGeocodedPlace } from './parseGeocodedPlace';
import type { LocationGeocodedAddress } from 'expo-location';

const apgujeong = tokenizeAdminText('압구정동');
assert.deepEqual(
  apgujeong.map((t) => `${t.kind}:${t.text}`),
  ['dong:압구정동'],
  '압구정동 must be one dong, not 압구+정동',
);

const glued = tokenizeAdminText('서울특별시강남구압구정동');
assert.ok(
  glued.some((t) => t.kind === 'dong' && t.text === '압구정동'),
  'glued address keeps 압구정동',
);
assert.ok(
  glued.some((t) => t.kind === 'gu' && t.text === '강남구'),
  'glued address keeps 강남구',
);
assert.equal(
  glued.some((t) => t.text === '압구'),
  false,
  '압구 must not be a gu token',
);

const jung = tokenizeAdminText('중구');
assert.deepEqual(jung.map((t) => `${t.kind}:${t.text}`), ['gu:중구']);

const addr = {
  city: '서울특별시',
  district: '강남구',
  name: '압구정동',
  street: '압구정동',
  formattedAddress: '대한민국 서울특별시 강남구 압구정동',
} as LocationGeocodedAddress;
const parsed = parseGeocodedPlace(addr);
assert.ok(parsed, 'parse apgujeong address');
assert.equal(parsed!.dong, '압구정동');
assert.equal(parsed!.gu, '강남구');
assert.notEqual(parsed!.gu, '압구');
const label = composeFineLabel(
  parsed!.city,
  parsed!.gu,
  parsed!.dong,
  { lat: 37.527, lng: 127.0286 },
  parsed!.eupMyon,
);
assert.equal(label, '압구정');
assert.equal(label?.includes('압구') && label !== '압구정', false);

console.log('adminTokens.check: ok');
