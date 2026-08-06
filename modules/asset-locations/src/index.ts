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

/** iOS UIBackgroundTask — false if native module missing or OS denied. */
export function beginBackgroundWork(name: string): boolean {
  if (AssetLocationsModule == null) {
    return false;
  }
  try {
    return AssetLocationsModule.beginBackgroundWork(name) === true;
  } catch (error) {
    console.warn('[asset-locations] beginBackgroundWork failed', error);
    return false;
  }
}

export function endBackgroundWork(): void {
  if (AssetLocationsModule == null) {
    return;
  }
  try {
    AssetLocationsModule.endBackgroundWork();
  } catch (error) {
    console.warn('[asset-locations] endBackgroundWork failed', error);
  }
}
