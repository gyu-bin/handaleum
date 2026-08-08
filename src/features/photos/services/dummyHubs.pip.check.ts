/**
 * Ensure __DEV__ dummy hub coordinates resolve via offline PIP.
 * Run: npx tsx src/features/photos/services/dummyHubs.pip.check.ts
 */
import assert from 'node:assert/strict';

import {
  lookupDong,
  resetDongLookupForTests,
} from '@/features/stamps/services/dongLookup';

resetDongLookupForTests();

/** Mirror of HUBS lat/lng in dummyPhotos.ts (keep in sync). */
const HUBS: { label: string; lat: number; lng: number }[] = [
  { label: '이태원', lat: 37.5345, lng: 126.9946 },
  { label: '수원', lat: 37.2636, lng: 127.0286 },
  { label: '송도', lat: 37.3825, lng: 126.6564 },
  { label: '강릉', lat: 37.765, lng: 128.897 },
  { label: '천안', lat: 36.815, lng: 127.113 },
  { label: '청주', lat: 36.635, lng: 127.491 },
  { label: '대전', lat: 36.328, lng: 127.427 },
  { label: '전주', lat: 35.815, lng: 127.153 },
  { label: '광주', lat: 35.1498, lng: 126.9195 },
  { label: '여수', lat: 34.7395, lng: 127.736 },
  { label: '대구', lat: 35.8667, lng: 128.597 },
  { label: '경주', lat: 35.8372, lng: 129.211 },
  { label: '해운대', lat: 35.1587, lng: 129.1604 },
  { label: '울산', lat: 35.538, lng: 129.338 },
  { label: '창원', lat: 35.221, lng: 128.685 },
  { label: '제주', lat: 33.4996, lng: 126.5312 },
];

for (const hub of HUBS) {
  const hit = lookupDong(hub.lat, hub.lng);
  assert.ok(hit, `${hub.label} (${hub.lat},${hub.lng}) should resolve`);
  console.log('ok', hub.label, '→', `${hit.sido}/${hit.city}/${hit.name}`);
}

console.log('dummyHubs.pip.check.ts: ok', HUBS.length, 'hubs');
