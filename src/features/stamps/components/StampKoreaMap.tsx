import {
  forwardRef,
  memo,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Mask, Path } from 'react-native-svg';

import koreaGeo from '@/assets/geo/korea.json';
import {
  bboxOf,
  createProjection,
  geometryToPath,
  pointInGeometry,
  type PackedGeometry,
  type Projection,
} from '@/features/photos/utils/geo';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import {
  getStampMapProvinces,
  getStampMapUnits,
  mapVisitKey,
  selectionFromUnit,
  unitsForSido,
  visitedL1Keys,
  type StampMapSelection,
} from '../services/stampMapIndex';
import { stampMapFill } from '../utils/stampMapFill';

const NATION_PAD = 20;
const SIDO_PAD = 36;
/** Shared stroke look — hairlines, not ink pens. */
const CELL = {
  emptyFill: theme.colors.landLight,
  emptyStrokeOp: 0.07,
  emptyStrokeW: 0.45,
  filledStrokeOp: 0.1,
  filledStrokeW: 0.4,
  rimStrokeOp: 0.18,
  rimStrokeW: 1.1,
  nationRimOp: 0.22,
  nationRimW: 1.25,
  nationEmptyStrokeOp: 0.1,
  nationEmptyStrokeW: 0.55,
  /** Visited L1 patches on the nation map (not whole 시·도). */
  nationL1WashOp: 0.72,
  nationL1StrokeOp: 0.08,
  nationL1StrokeW: 0.35,
  hinterlandOp: 0.22,
} as const;
const FOCUS_BBOX = {
  minLng: 125.85,
  maxLng: 129.6,
  minLat: 33.05,
  maxLat: 38.6,
};

export type StampKoreaMapMode = 'nation' | 'sido';

export type StampKoreaMapHandle = {
  /** Hit-test in map-local (unzoomed child) coordinates. */
  hitTest: (x: number, y: number) => StampMapSelection | null;
};

export interface StampKoreaMapProps {
  collected: StampsCollected;
  mode: StampKoreaMapMode;
  /** Required when mode === 'sido'. */
  focusSido?: string;
  style?: ViewStyle;
}

type NationSidoHit = {
  name: string;
  geometry: PackedGeometry;
  d: string;
};

type NationL1Patch = {
  visitKey: string;
  d: string;
  fill: string;
};

type L1Hit = {
  selection: StampMapSelection;
  geometry: PackedGeometry;
  visitKey: string;
  label: string;
  d: string;
  filled: boolean;
  fill: string;
};

/**
 * Real Korea atlas — nation paints visited L1 patches only (not whole 시·도);
 * drill paints that 시·도의 L1 cells. Taps = hitTest.
 */
export const StampKoreaMap = memo(
  forwardRef<StampKoreaMapHandle, StampKoreaMapProps>(function StampKoreaMap(
    { collected, mode, focusSido, style },
    ref,
  ) {
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
    const visitedL1 = useMemo(() => visitedL1Keys(collected), [collected]);

    const focusProvince = useMemo(() => {
      if (mode !== 'sido' || !focusSido) {
        return null;
      }
      return provinces.find((p) => p.name === focusSido) ?? null;
    }, [focusSido, mode, provinces]);

    const projection = useMemo((): Projection | null => {
      if (size.width <= 0 || size.height <= 0) {
        return null;
      }
      if (mode === 'sido' && focusProvince) {
        return createProjection(
          bboxOf(focusProvince.geometry),
          size.width,
          size.height,
          SIDO_PAD,
        );
      }
      const raw = bboxOf(southKorea);
      const focused = {
        minLng: Math.max(raw.minLng, FOCUS_BBOX.minLng),
        maxLng: Math.min(raw.maxLng, FOCUS_BBOX.maxLng),
        minLat: Math.max(raw.minLat, FOCUS_BBOX.minLat),
        maxLat: Math.min(raw.maxLat, FOCUS_BBOX.maxLat),
      };
      return createProjection(focused, size.width, size.height, NATION_PAD);
    }, [focusProvince, mode, size.height, size.width, southKorea]);

    const koreaPath = useMemo(
      () => (projection ? geometryToPath(southKorea, projection.project) : ''),
      [projection, southKorea],
    );

    /** 시·도 outlines only — never fill a whole province for one 동. */
    const nationSidos = useMemo((): NationSidoHit[] => {
      if (!projection || mode !== 'nation') {
        return [];
      }
      return provinces.map((p) => ({
        name: p.name,
        geometry: p.geometry,
        d: geometryToPath(p.geometry, projection.project),
      }));
    }, [mode, projection, provinces]);

    /** Visited 구·시·군 patches at national scale. */
    const nationL1Patches = useMemo((): NationL1Patch[] => {
      if (!projection || mode !== 'nation' || visitedL1.size === 0) {
        return [];
      }
      const patches: NationL1Patch[] = [];
      for (const u of getStampMapUnits()) {
        const visitKey = mapVisitKey(u.sido, u.key);
        if (!visitedL1.has(visitKey)) {
          continue;
        }
        patches.push({
          visitKey,
          d: geometryToPath(u.geometry, projection.project),
          fill: stampMapFill(visitKey),
        });
      }
      return patches;
    }, [mode, projection, visitedL1]);

    const l1Drawn = useMemo((): L1Hit[] => {
      if (!projection || mode !== 'sido' || !focusSido) {
        return [];
      }
      return unitsForSido(focusSido).map((u) => {
        const visitKey = mapVisitKey(u.sido, u.key);
        return {
          selection: selectionFromUnit(u),
          geometry: u.geometry,
          visitKey,
          label: u.label,
          d: geometryToPath(u.geometry, projection.project),
          filled: visitedL1.has(visitKey),
          fill: stampMapFill(visitKey),
        };
      });
    }, [focusSido, mode, projection, visitedL1]);

    const focusOutline = useMemo(() => {
      if (!projection || !focusProvince) {
        return '';
      }
      return geometryToPath(focusProvince.geometry, projection.project);
    }, [focusProvince, projection]);

    useImperativeHandle(
      ref,
      () => ({
        hitTest: (x: number, y: number) => {
          if (!projection) {
            return null;
          }
          const [lng, lat] = projection.unproject([x, y]);
          if (mode === 'nation') {
            for (const p of nationSidos) {
              if (pointInGeometry(lng, lat, p.geometry)) {
                return { sido: p.name, l1Key: null };
              }
            }
            return null;
          }
          for (const u of l1Drawn) {
            if (pointInGeometry(lng, lat, u.geometry)) {
              return u.selection;
            }
          }
          return null;
        },
      }),
      [l1Drawn, mode, nationSidos, projection],
    );

    const a11y =
      mode === 'sido' && focusSido
        ? strings.stamps.mapA11ySido(focusSido)
        : strings.stamps.mapA11y;

    return (
      <View
        style={[styles.wrap, style]}
        onLayout={onLayout}
        pointerEvents="none"
        accessibilityRole="image"
        accessibilityLabel={a11y}
      >
        {size.width > 0 && koreaPath && projection ? (
          <Svg width={size.width} height={size.height}>
            {mode === 'nation' ? (
              <>
                <Defs>
                  <Mask id="koreaMask" x="0" y="0" width="100%" height="100%">
                    <Path d={koreaPath} fill={theme.colors.white} />
                  </Mask>
                </Defs>

                <Path d={koreaPath} fill={theme.colors.land} />

                <G mask="url(#koreaMask)">
                  {nationSidos.map((p) => (
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
                  {nationL1Patches.map((p) => (
                    <Path
                      key={p.visitKey}
                      d={p.d}
                      fill={p.fill}
                      fillOpacity={CELL.nationL1WashOp}
                      stroke={theme.colors.ink}
                      strokeWidth={CELL.nationL1StrokeW}
                      strokeOpacity={CELL.nationL1StrokeOp}
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
              </>
            ) : (
              <>
                <Path
                  d={koreaPath}
                  fill={theme.colors.landDeep}
                  fillOpacity={CELL.hinterlandOp}
                />

                {l1Drawn.map((u) => (
                  <Path
                    key={u.visitKey}
                    d={u.d}
                    fill={u.filled ? u.fill : CELL.emptyFill}
                    stroke={theme.colors.ink}
                    strokeWidth={
                      u.filled ? CELL.filledStrokeW : CELL.emptyStrokeW
                    }
                    strokeOpacity={
                      u.filled ? CELL.filledStrokeOp : CELL.emptyStrokeOp
                    }
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}

                {focusOutline ? (
                  <Path
                    d={focusOutline}
                    fill="none"
                    stroke={theme.colors.ink}
                    strokeWidth={CELL.rimStrokeW}
                    strokeOpacity={CELL.rimStrokeOp}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
              </>
            )}
          </Svg>
        ) : null}
      </View>
    );
  }),
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
