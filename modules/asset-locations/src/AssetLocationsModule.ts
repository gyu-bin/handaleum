import { requireOptionalNativeModule } from 'expo-modules-core';

import type { AssetLocationRow } from './AssetLocations.types';

type NativeAssetLocations = {
  getAssetLocationsAsync(ids: string[]): Promise<AssetLocationRow[]>;
  beginBackgroundWork(name: string): boolean;
  endBackgroundWork(): void;
};

export default requireOptionalNativeModule<NativeAssetLocations>('AssetLocations');
