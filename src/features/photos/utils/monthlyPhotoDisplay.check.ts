/**
 * Run: npx tsx src/features/photos/utils/monthlyPhotoDisplay.check.ts
 */
import assert from 'node:assert/strict';

import { getAllMonthlyPhotos, isLocatedPhoto } from './monthlyPhotoDisplay';

const photos = getAllMonthlyPhotos({
  photos: [
    {
      assetId: 'located',
      takenAt: '2026-09-03T12:00:00.000Z',
      lat: 37.5,
      lng: 127,
    },
  ],
  noLocationPhotos: [
    { assetId: 'no-location', takenAt: '2026-09-02T12:00:00.000Z' },
    { assetId: 'located', takenAt: '2026-09-03T12:00:00.000Z' },
  ],
});

assert.deepEqual(photos.map((photo) => photo.assetId), ['no-location', 'located']);
assert.equal(isLocatedPhoto(photos[0]!), false);
assert.equal(isLocatedPhoto(photos[1]!), true);

console.log('monthlyPhotoDisplay.check ok');
