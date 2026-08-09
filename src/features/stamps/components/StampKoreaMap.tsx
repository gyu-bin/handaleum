import { memo, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, Text as SvgText } from 'react-native-svg';

import koreaGeo from '@/assets/geo/korea.json';
import {
  bboxOf,
  createProjection,
  geometryToPath,
  labelAnchorOf,
  mainlandPolygons,
  type PackedGeometry,
  type Projection,
} from '@/features/photos/utils/geo';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import { getStampMapProvinces } from '../services/stampMapIndex';
import {
  stampBlobFillForSido,
  stampMapLabelForSido,
} from '../services/stampMapPalette';
import { visitDotsFromCollected } from '../services/stampVisitDots';

const NATION_PAD = 20;
/** Soft “동 방울” — outer halo + inner core (not a pin dot). */
const BLOB_OUTER_R = 5.2;
const BLOB_INNER_R = 3.1;
const BLOB_OUTER_OP = 0.38;
const BLOB_INNER_OP = 0.92;
const LABEL_SIZE = 9;

const CELL = {
  nationRimOp: 0.22,
  nationRimW: 1.25,
  nationEmptyStrokeOp: 0.12,
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
 * Glance map — empty 시·도 land + pastel blobs per visited 동 (option B).
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
  // Drop 백령도 등 far-west scraps so the glance map matches the peninsula focus.
  const koreaLand = useMemo(
    () => mainlandPolygons(southKorea, FOCUS_BBOX.minLng),
    [southKorea],
  );

  const projection = useMemo((): Projection | null => {
    if (size.width <= 0 || size.height <= 0) {
      return null;
    }
    const raw = bboxOf(koreaLand);
    const focused = {
      minLng: Math.max(raw.minLng, FOCUS_BBOX.minLng),
      maxLng: Math.min(raw.maxLng, FOCUS_BBOX.maxLng),
      minLat: Math.max(raw.minLat, FOCUS_BBOX.minLat),
      maxLat: Math.min(raw.maxLat, FOCUS_BBOX.maxLat),
    };
    return createProjection(focused, size.width, size.height, NATION_PAD);
  }, [koreaLand, size.height, size.width]);

  const koreaPath = useMemo(
    () => (projection ? geometryToPath(koreaLand, projection.project) : ''),
    [koreaLand, projection],
  );

  const sidoLayers = useMemo(() => {
    if (!projection) {
      return [];
    }
    // Drop far-west island scraps so 인천/전남 labels aren't ocean-anchored.
    const minLng = FOCUS_BBOX.minLng;
    return provinces.map((p) => {
      const land = mainlandPolygons(p.geometry, minLng);
      const [lng, lat] = labelAnchorOf(p.geometry, minLng);
      const [x, y] = projection.project([lng, lat]);
      return {
        name: p.name,
        d: geometryToPath(land, projection.project),
        label: stampMapLabelForSido(p.name),
        lx: x,
        ly: y,
      };
    });
  }, [projection, provinces]);

  const blobs = useMemo(() => {
    if (!projection) {
      return [];
    }
    return visitDotsFromCollected(collected).map((dot) => {
      const [x, y] = projection.project([dot.lng, dot.lat]);
      return {
        id: dot.id,
        x,
        y,
        fill: stampBlobFillForSido(dot.sido),
      };
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
            {sidoLayers.map((p) => (
              <Path
                key={p.name}
                d={p.d}
                fill={theme.colors.landLight}
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

          {blobs.map((b) => (
            <G key={b.id}>
              <Circle
                cx={b.x}
                cy={b.y}
                r={BLOB_OUTER_R}
                fill={b.fill}
                fillOpacity={BLOB_OUTER_OP}
              />
              <Circle
                cx={b.x}
                cy={b.y}
                r={BLOB_INNER_R}
                fill={b.fill}
                fillOpacity={BLOB_INNER_OP}
              />
            </G>
          ))}

          {sidoLayers.map((p) => (
            <SvgText
              key={`label-${p.name}`}
              x={p.lx}
              y={p.ly}
              fill={theme.colors.ink}
              fontSize={LABEL_SIZE}
              fontWeight="600"
              textAnchor="middle"
              alignmentBaseline="middle"
              opacity={0.55}
            >
              {p.label}
            </SvgText>
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
