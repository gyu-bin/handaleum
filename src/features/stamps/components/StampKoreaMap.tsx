import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Mask, Path } from 'react-native-svg';

import koreaGeo from '@/assets/geo/korea.json';
import {
  bboxOf,
  createProjection,
  geometryToPath,
  type PackedGeometry,
} from '@/features/photos/utils/geo';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import {
  getStampMapRegions,
  isStampMapRegionVisited,
} from '../services/stampMapIndex';

const MAP_PAD = 18;
const FOCUS_BBOX = {
  minLng: 125.85,
  maxLng: 129.6,
  minLat: 33.05,
  maxLat: 38.6,
};

/** Minimal ink ladder — one family, readable on cream land. */
const FILL_PALETTE = [
  '#2C3E50',
  '#3A4F63',
  '#455A6E',
  '#51657A',
  '#5A6B7A',
  '#667889',
  '#718294',
  '#4A5C6E',
] as const;

function colorForKey(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h + id.charCodeAt(i) * (i + 3)) % 997;
  }
  return FILL_PALETTE[h % FILL_PALETTE.length]!;
}

export interface StampKoreaMapProps {
  collected: StampsCollected;
  onSelectSido: (sido: string) => void;
  style?: ViewStyle;
}

/**
 * Visit atlas at 동 grain — paint visited dongs only (full quilt is too heavy).
 */
export const StampKoreaMap = memo(function StampKoreaMap({
  collected,
  onSelectSido,
  style,
}: StampKoreaMapProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (
      Math.abs(width - size.width) < 1 &&
      Math.abs(height - size.height) < 1
    ) {
      return;
    }
    setSize({ width, height });
  };

  const southKorea = koreaGeo.korea as unknown as PackedGeometry;
  const regions = getStampMapRegions();

  const projection = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) {
      return null;
    }
    const raw = bboxOf(southKorea);
    const focused = {
      minLng: Math.max(raw.minLng, FOCUS_BBOX.minLng),
      maxLng: Math.min(raw.maxLng, FOCUS_BBOX.maxLng),
      minLat: Math.max(raw.minLat, FOCUS_BBOX.minLat),
      maxLat: Math.min(raw.maxLat, FOCUS_BBOX.maxLat),
    };
    return createProjection(focused, size.width, size.height, MAP_PAD);
  }, [southKorea, size.height, size.width]);

  const koreaPath = useMemo(
    () => (projection ? geometryToPath(southKorea, projection.project) : ''),
    [projection, southKorea],
  );

  const drawn = useMemo(() => {
    if (!projection) {
      return [];
    }
    return regions.map((r) => ({
      ...r,
      d: geometryToPath(r.geometry, projection.project),
      visited: isStampMapRegionVisited(collected, r),
      color: colorForKey(r.key),
    }));
  }, [collected, projection, regions]);

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={onLayout}
      accessibilityRole="image"
      accessibilityLabel={strings.stamps.mapA11y}
    >
      {size.width > 0 && koreaPath ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <Mask id="koreaMask" x="0" y="0" width="100%" height="100%">
              <Path d={koreaPath} fill="#FFFFFF" />
            </Mask>
          </Defs>
          <Path d={koreaPath} fill={theme.colors.land} />
          <G mask="url(#koreaMask)">
            {drawn.map((r) =>
              r.visited ? (
                <Path
                  key={`fill-${r.key}`}
                  d={r.d}
                  fill={r.color}
                  fillOpacity={0.9}
                  onPress={() => onSelectSido(r.sido)}
                  accessibilityLabel={r.name}
                />
              ) : null,
            )}
          </G>
          <Path
            d={koreaPath}
            fill="none"
            stroke={theme.colors.ink}
            strokeWidth={1.25}
            strokeOpacity={0.22}
          />
        </Svg>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
