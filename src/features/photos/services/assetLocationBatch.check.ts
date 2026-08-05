/**
 * Runnable check for native-row → PhotoRef mapping rules.
 * Run: npx tsx src/features/photos/services/assetLocationBatch.check.ts
 */
function applyRow(row: {
  latitude?: number;
  longitude?: number;
}): 'located' | 'no-location' {
  const { latitude: lat, longitude: lng } = row;
  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return 'located';
  }
  return 'no-location';
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(msg);
  }
}

assert(applyRow({ latitude: 37.5, longitude: 127.0 }) === 'located', 'gps');
assert(applyRow({}) === 'no-location', 'empty');
assert(applyRow({ latitude: NaN, longitude: 1 }) === 'no-location', 'nan');
console.log('assetLocationBatch.check ok');
