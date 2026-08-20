/**
 * Runnable check for hidden-photo filter.
 * Run: npx tsx src/features/photos/utils/withoutHiddenPhotos.check.ts
 */
import assert from 'node:assert/strict';

import { withoutHiddenPhotos } from './withoutHiddenPhotos';

const photos = [
  { assetId: 'a' },
  { assetId: 'b' },
  { assetId: 'c' },
];

assert.deepEqual(withoutHiddenPhotos(photos, new Set()), photos);
assert.deepEqual(
  withoutHiddenPhotos(photos, new Set(['b'])).map((p) => p.assetId),
  ['a', 'c'],
);
assert.deepEqual(withoutHiddenPhotos(photos, new Set(['a', 'b', 'c'])), []);

console.log('withoutHiddenPhotos.check ok');
