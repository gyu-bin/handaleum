/**
 * Runnable check: dong photo index must not wipe on an empty rebuild.
 * Run: npx tsx src/features/stamps/services/stampDongPhotos.check.ts
 */
import assert from 'node:assert/strict';

import { lookupDong, resetDongLookupForTests } from './dongLookup';
import {
  photosForStampLeaf,
  prebuildStampDongPhotoIndex,
  resetStampDongPhotoIndex,
} from './stampDongPhotos';

async function main(): Promise<void> {
  resetDongLookupForTests();
  resetStampDongPhotoIndex();

  const yeoksam = {
    assetId: 'check-yeoksam',
    takenAt: new Date(2026, 7, 10, 12, 0, 0).toISOString(),
    lat: 37.50192727272727,
    lng: 127.03861818181818,
  };

  const hit = lookupDong(yeoksam.lat, yeoksam.lng);
  assert.ok(hit, '역삼 sample should resolve');

  await prebuildStampDongPhotoIndex([yeoksam]);
  const query = { sido: '서울', city: '서울', leaf: hit.name };
  const first = await photosForStampLeaf(query);
  assert.equal(first.length, 1, 'indexed photo should resolve by stamp city');
  assert.equal(first[0]?.assetId, yeoksam.assetId);

  await prebuildStampDongPhotoIndex([]);
  const still = await photosForStampLeaf(query);
  assert.equal(still.length, 1, 'empty rebuild must not wipe a warm index');

  console.log('stampDongPhotos.check.ts: ok', hit.name);
}

void main();
