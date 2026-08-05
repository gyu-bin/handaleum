import AssetLocationsModule from './AssetLocationsModule';
import type { AssetLocationRow } from './AssetLocations.types';

export type { AssetLocationRow };

/** False until a native rebuild links the AssetLocations module. */
export function isAssetLocationsNativeAvailable(): boolean {
  return AssetLocationsModule != null;
}

/**
 * Batch-read GPS for MediaLibrary asset ids.
 * iOS: PHAsset.location only (no file open).
 * Android: EXIF lat/lng via MediaStore (minimal read).
 * Returns null when the native module is not in the binary (use getAssetInfoAsync).
 */
export async function getAssetLocationsAsync(
  ids: string[],
): Promise<AssetLocationRow[] | null> {
  if (AssetLocationsModule == null) {
    return null;
  }
  if (ids.length === 0) {
    return [];
  }
  return AssetLocationsModule.getAssetLocationsAsync(ids);
}
