import { requireOptionalNativeModule } from 'expo-modules-core';

import type { AssetLocationRow } from './AssetLocations.types';

type NativeAssetLocations = {
  getAssetLocationsAsync(ids: string[]): Promise<AssetLocationRow[]>;
};

export default requireOptionalNativeModule<NativeAssetLocations>('AssetLocations');
