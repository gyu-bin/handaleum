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
  { label: '성수', lat: 37.5446, lng: 127.0559 },
  { label: '홍대', lat: 37.5563, lng: 126.9236 },
  { label: '강남', lat: 37.5007, lng: 127.0365 },
  { label: '판교', lat: 37.3947, lng: 127.1112 },
];

for (const hub of HUBS) {
  const hit = lookupDong(hub.lat, hub.lng);
  assert.ok(hit, `${hub.label} (${hub.lat},${hub.lng}) should resolve`);
  console.log('ok', hub.label, '→', `${hit.sido}/${hit.city}/${hit.name}`);
}

console.log('dummyHubs.pip.check.ts: ok', HUBS.length, 'hubs');
