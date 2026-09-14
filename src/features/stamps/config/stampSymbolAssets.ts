import type { ImageSourcePropType } from 'react-native';

import type { StampSymbol } from './stampVisuals';

/** Shared 12 symbol PNGs (sliced from design sheet). Tint with stamp ink. */
export const STAMP_SYMBOL_ASSETS: Record<StampSymbol, ImageSourcePropType> = {
  mountain: require('../../../../assets/stamps/symbols/mountain.png'),
  water: require('../../../../assets/stamps/symbols/water.png'),
  forest: require('../../../../assets/stamps/symbols/forest.png'),
  heritage: require('../../../../assets/stamps/symbols/heritage.png'),
  city: require('../../../../assets/stamps/symbols/city.png'),
  bridge: require('../../../../assets/stamps/symbols/bridge.png'),
  street: require('../../../../assets/stamps/symbols/street.png'),
  cafe: require('../../../../assets/stamps/symbols/cafe.png'),
  market: require('../../../../assets/stamps/symbols/market.png'),
  village: require('../../../../assets/stamps/symbols/village.png'),
  industry: require('../../../../assets/stamps/symbols/industry.png'),
  landmark: require('../../../../assets/stamps/symbols/landmark.png'),
};

export function stampSymbolAsset(
  symbol: StampSymbol,
): ImageSourcePropType {
  return STAMP_SYMBOL_ASSETS[symbol];
}
