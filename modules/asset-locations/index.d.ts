export type AssetLocationRow = {
  id: string;
  latitude?: number;
  longitude?: number;
};

export function isAssetLocationsNativeAvailable(): boolean;

export function getAssetLocationsAsync(
  ids: string[],
): Promise<AssetLocationRow[] | null>;

export function beginBackgroundWork(name: string): boolean;

export function endBackgroundWork(): void;
