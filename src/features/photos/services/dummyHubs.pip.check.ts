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
  { label: '시청', lat: 37.5665, lng: 126.978 },
  { label: '강남', lat: 37.5007, lng: 127.0365 },
  { label: '압구정', lat: 37.527, lng: 127.0286 },
  { label: '홍대', lat: 37.5563, lng: 126.9236 },
  { label: '연남', lat: 37.5605, lng: 126.923 },
  { label: '성수', lat: 37.5446, lng: 127.0559 },
  { label: '잠실', lat: 37.5112, lng: 127.0981 },
  { label: '경복', lat: 37.5796, lng: 126.977 },
  { label: '북촌', lat: 37.5826, lng: 126.983 },
  { label: '신림', lat: 37.4842, lng: 126.9297 },
  { label: '이태원', lat: 37.5345, lng: 126.9946 },
  { label: '여의도', lat: 37.5219, lng: 126.9245 },
  { label: '판교', lat: 37.3947, lng: 127.1112 },
  { label: '수원', lat: 37.2636, lng: 127.0286 },
  { label: '고양', lat: 37.6584, lng: 126.832 },
  { label: '용인', lat: 37.2411, lng: 127.1776 },
  { label: '부천', lat: 37.5034, lng: 126.766 },
  { label: '안양', lat: 37.3943, lng: 126.9568 },
  { label: '파주', lat: 37.7599, lng: 126.7802 },
  { label: '가평', lat: 37.8315, lng: 127.5095 },
  { label: '하남', lat: 37.5394, lng: 127.2145 },
  { label: '해운대', lat: 35.1587, lng: 129.1604 },
  { label: '광안', lat: 35.158, lng: 129.113 },
  { label: '인천공항', lat: 37.4601, lng: 126.4407 },
  { label: '제주', lat: 33.4996, lng: 126.5312 },
  { label: '중문', lat: 33.2528, lng: 126.4183 },
];

for (const hub of HUBS) {
  const hit = lookupDong(hub.lat, hub.lng);
  assert.ok(hit, `${hub.label} (${hub.lat},${hub.lng}) should resolve`);
  console.log('ok', hub.label, '→', `${hit.sido}/${hit.city}/${hit.name}`);
}

console.log('dummyHubs.pip.check.ts: ok', HUBS.length, 'hubs');
