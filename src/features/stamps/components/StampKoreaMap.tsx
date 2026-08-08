import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path } from 'react-native-svg';

import koreaGeo from '@/assets/geo/korea.json';
import {
  bboxOf,
  createProjection,
  geometryToPath,
  type PackedGeometry,
  type Projection,
} from '@/features/photos/utils/geo';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import { getStampMapProvinces } from '../services/stampMapIndex';
import { visitDotsFromCollected } from '../services/stampVisitDots';

const NATION_PAD = 20;
const DOT_R = 2.4;
const DOT_OP = 0.88;

const CELL = {
  emptyFill: theme.colors.landLight,
  nationRimOp: 0.22,
  nationRimW: 1.25,
  nationEmptyStrokeOp: 0.1,
  nationEmptyStrokeW: 0.55,
} as const;

const FOCUS_BBOX = {
  minLng: 125.85,
  maxLng: 129.6,
  minLat: 33.05,
  maxLat: 38.6,
};

export interface StampKoreaMapProps {
  collected: StampsCollected;
  style?: ViewStyle;
}

/**
 * Glance map — nation outlines + one ink dot per visited 동 (no tap, no wash).
 */
export const StampKoreaMap = memo(function StampKoreaMap({
  collected,
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
  const provinces = getStampMapProvinces();

  const projection = useMemo((): Projection | null => {
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
    return createProjection(focused, size.width, size.height, NATION_PAD);
  }, [size.height, size.width, southKorea]);

  const koreaPath = useMemo(
    () => (projection ? geometryToPath(southKorea, projection.project) : ''),
    [projection, southKorea],
  );

  const sidoPaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    return provinces.map((p) => ({
      name: p.name,
      d: geometryToPath(p.geometry, projection.project),
    }));
  }, [projection, provinces]);

  const dots = useMemo(() => {
    if (!projection) {
      return [];
    }
    return visitDotsFromCollected(collected).map((dot) => {
      const [x, y] = projection.project([dot.lng, dot.lat]);
      return { id: dot.id, x, y };
    });
  }, [collected, projection]);

  return (
    <View
      style={[styles.wrap, style]}
      onLayout={onLayout}
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel={strings.stamps.mapA11y}
    >
      {size.width > 0 && koreaPath && projection ? (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <Mask id="koreaMask" x="0" y="0" width="100%" height="100%">
              <Path d={koreaPath} fill={theme.colors.white} />
            </Mask>
          </Defs>

          <Path d={koreaPath} fill={theme.colors.land} />

          <G mask="url(#koreaMask)">
            {sidoPaths.map((p) => (
              <Path
                key={p.name}
                d={p.d}
                fill={CELL.emptyFill}
                stroke={theme.colors.ink}
                strokeWidth={CELL.nationEmptyStrokeW}
                strokeOpacity={CELL.nationEmptyStrokeOp}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </G>

          <Path
            d={koreaPath}
            fill="none"
            stroke={theme.colors.ink}
            strokeWidth={CELL.nationRimW}
            strokeOpacity={CELL.nationRimOp}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {dots.map((d) => (
            <Circle
              key={d.id}
              cx={d.x}
              cy={d.y}
              r={DOT_R}
              fill={theme.colors.ink}
              fillOpacity={DOT_OP}
            />
          ))}
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
