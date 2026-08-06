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
  getStampMapProvinces,
  getStampMapUnits,
  selectionFromUnit,
  visitedL1Keys,
  type StampMapSelection,
} from '../services/stampMapIndex';

const MAP_PAD = 18;
const FOCUS_BBOX = {
  minLng: 125.85,
  maxLng: 129.6,
  minLat: 33.05,
  maxLat: 38.6,
};

export interface StampKoreaMapProps {
  collected: StampsCollected;
  onSelect: (selection: StampMapSelection) => void;
  style?: ViewStyle;
}

/**
 * Coloring-book atlas: empty 구·시·군 cells + ink fill when any leaf visited.
 */
export const StampKoreaMap = memo(function StampKoreaMap({
  collected,
  onSelect,
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
  const units = getStampMapUnits();
  const provinces = getStampMapProvinces();
  const visited = useMemo(() => visitedL1Keys(collected), [collected]);

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

  const unitDrawn = useMemo(() => {
    if (!projection) {
      return [];
    }
    return units.map((u) => ({
      ...u,
      d: geometryToPath(u.geometry, projection.project),
      filled: visited.has(u.key),
    }));
  }, [projection, units, visited]);

  const provinceOutlines = useMemo(() => {
    if (!projection) {
      return [];
    }
    return provinces.map((p) => ({
      name: p.name,
      d: geometryToPath(p.geometry, projection.project),
    }));
  }, [projection, provinces]);

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
              <Path d={koreaPath} fill={theme.colors.white} />
            </Mask>
          </Defs>

          <Path d={koreaPath} fill={theme.colors.land} />

          <G mask="url(#koreaMask)">
            {unitDrawn.map((u) => (
              <Path
                key={u.key}
                d={u.d}
                fill={u.filled ? theme.tint.strong : theme.colors.landLight}
                stroke={theme.colors.ink}
                strokeWidth={u.filled ? 0.55 : 0.7}
                strokeOpacity={u.filled ? 0.2 : 0.22}
                onPress={() => onSelect(selectionFromUnit(u))}
                accessibilityLabel={u.label}
              />
            ))}
          </G>

          {/* Soft 시·도 outlines for national structure */}
          {provinceOutlines.map((p) => (
            <Path
              key={`prov-${p.name}`}
              d={p.d}
              fill="none"
              stroke={theme.colors.ink}
              strokeWidth={1.15}
              strokeOpacity={0.32}
            />
          ))}

          <Path
            d={koreaPath}
            fill="none"
            stroke={theme.colors.ink}
            strokeWidth={1.4}
            strokeOpacity={0.38}
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
