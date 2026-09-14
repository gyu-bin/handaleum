import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

import { sidoStampAsset } from '../config/sidoStampAssets';
import { stampSymbolAsset } from '../config/stampSymbolAssets';
import {
  romanizeStampName,
  stampInkForState,
  stampSymbolFor,
  stampVariationFor,
  type StampLevel,
} from '../config/stampVisuals';

export type TravelStampSize = 'book' | 'grid' | 'leaf' | 'hero';

const SIZE_PX: Record<TravelStampSize, number> = {
  book: 108,
  grid: 96,
  leaf: 82,
  hero: 148,
};

/** Visited inks for district/neighborhood (sido PNGs keep baked colors). */
const LEAF_INKS = [
  '#E0453C', '#C4925A', '#3B9AD9', '#3A9BC8', '#E04A8A', '#4558A8',
  '#2A9A88', '#8B55B8', '#3D9A55', '#9A6A45', '#5AAA4A', '#C09050',
  '#E07058', '#3A6FB5', '#C04588', '#2A9A9A', '#7A4AB0', '#33475B',
] as const;

export interface TravelStampProps {
  name: string;
  stampKey?: string;
  level?: StampLevel;
  nameEn?: string;
  collected: boolean;
  size?: TravelStampSize;
  brand?: boolean;
}

function hash(key: string): number {
  let value = 0;
  for (let i = 0; i < key.length; i += 1) {
    value = (value * 31 + key.charCodeAt(i)) >>> 0;
  }
  return value;
}

function englishDistrictLabel(ko: string, fallback?: string): string {
  if (fallback) {
    return fallback.toUpperCase();
  }
  let base = ko;
  let suffix = '';
  if (ko.endsWith('구')) {
    base = ko.slice(0, -1);
    suffix = '-GU';
  } else if (ko.endsWith('군')) {
    base = ko.slice(0, -1);
    suffix = '-GUN';
  } else if (ko.endsWith('시')) {
    base = ko.slice(0, -1);
    suffix = '-SI';
  }
  const rom = romanizeStampName(base).replace(/[^A-Z]/g, '');
  const label = `${rom}${suffix}`;
  return label.length > 14 ? rom.slice(0, 12) : label;
}

/**
 * Passport travel seal.
 * 시·도 = full-face PNG (17). 구·동 = ring SVG + symbol PNG + stacked labels.
 */
export function TravelStamp({
  name,
  stampKey,
  level = 'district',
  nameEn,
  collected,
  size = 'book',
}: TravelStampProps) {
  const dim = SIZE_PX[size];
  const key = stampKey ?? name;

  if (level === 'sido') {
    const asset = sidoStampAsset(name);
    if (asset) {
      return (
        <View style={{ width: dim, height: dim }} accessibilityLabel={name}>
          <Image
            source={asset}
            style={{
              width: dim,
              height: dim,
              opacity: collected ? 1 : 0.55,
              tintColor: collected ? undefined : theme.colors.stampInkEmpty,
            }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      );
    }
  }

  const ink = collected
    ? LEAF_INKS[hash(key) % LEAF_INKS.length]!
    : theme.colors.stampInkEmpty;
  const variation = stampVariationFor(key);
  const symbol = stampSymbolFor(stampKey, name, level);
  const short = name.length > 5 ? `${name.slice(0, 4)}…` : name;
  const en = englishDistrictLabel(name, nameEn).slice(0, 14);
  const showBrand = level !== 'neighborhood' && size !== 'leaf';
  const leaf = level === 'neighborhood' || size === 'leaf';
  const iconPx = Math.round(dim * (leaf ? 0.38 : 0.4) * variation.iconScale);

  return (
    <View
      style={{ width: dim, height: dim, opacity: collected ? 1 : 0.72 }}
      accessibilityLabel={name}
    >
      <Svg width={dim} height={dim} viewBox="0 0 256 256">
        <Circle
          cx={128}
          cy={128}
          r={118}
          fill="none"
          stroke={ink}
          strokeWidth={5}
          opacity={variation.inkOpacity}
        />
        <Circle
          cx={128}
          cy={128}
          r={100}
          fill="none"
          stroke={ink}
          strokeWidth={2.2}
          strokeDasharray="5 7"
          opacity={0.75 * variation.inkOpacity}
        />
        {[0, 90, 180, 270].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return (
            <Path
              key={deg}
              d={`M ${128 + Math.cos(a) * 106} ${128 + Math.sin(a) * 106} L ${128 + Math.cos(a) * 116} ${128 + Math.sin(a) * 116}`}
              stroke={ink}
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={0.8 * variation.inkOpacity}
            />
          );
        })}
      </Svg>

      {/* EN → symbol → KO → brand — stacked so they never overlap */}
      <View style={styles.stack} pointerEvents="none">
        <Text
          style={[
            styles.en,
            { color: ink, fontSize: leaf ? 6.5 : 7.5 },
          ]}
          numberOfLines={1}
        >
          {en}
        </Text>
        <View style={styles.symbolSlot}>
          <Image
            source={stampSymbolAsset(symbol)}
            style={{
              width: iconPx,
              height: iconPx,
              tintColor: ink,
              opacity: variation.inkOpacity,
              transform: [{ translateY: variation.iconDy }],
            }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
        <Text
          style={[
            styles.ko,
            { color: ink, fontSize: leaf ? 11 : 13 },
          ]}
          numberOfLines={1}
        >
          {short}
        </Text>
        {showBrand ? (
          <Text style={[styles.brand, { color: ink }]} numberOfLines={1}>
            HANDALEUM
          </Text>
        ) : (
          <View style={styles.brandSpacer} />
        )}
      </View>
    </View>
  );
}

/** @deprecated */
export function stampInkForKey(_key: string): string {
  return stampInkForState(true);
}

const styles = StyleSheet.create({
  stack: {
    ...StyleSheet.absoluteFillObject,
    paddingTop: '11%',
    paddingBottom: '9%',
    paddingHorizontal: '12%',
    alignItems: 'center',
  },
  en: {
    fontFamily: theme.fonts.sans,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    opacity: 0.92,
    textAlign: 'center',
  },
  symbolSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    width: '100%',
  },
  ko: {
    fontFamily: theme.fonts.sans,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
  brand: {
    fontFamily: theme.fonts.sans,
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginTop: 2,
    opacity: 0.55,
  },
  brandSpacer: {
    height: 6,
  },
});
