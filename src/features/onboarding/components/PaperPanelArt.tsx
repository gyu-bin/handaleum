import { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { catmullRomPath } from '@/features/photos/utils/geo';
import { getMapPalette } from '@/shared/constants/mapThemes';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

const PIN_R = 26;
const LABEL_H = 14;
const CARET = 6;
const PAD = 20;

/** Same multi-pass coast as MapSvg — readable ink silhouette. */
const COAST_PASSES: { dx: number; dy: number; opacity: number; width: number }[] =
  [
    { dx: 0.9, dy: 0.75, opacity: 0.1, width: 1.6 },
    { dx: -0.5, dy: 0.4, opacity: 0.14, width: 1.15 },
    { dx: 0.25, dy: -0.2, opacity: 0.22, width: 0.85 },
    { dx: 0, dy: 0, opacity: 0.55, width: 0.7 },
  ];

/**
 * Soft sea washes in viewBox space — cream paper shows through;
 * dawn water (#BFD7E8) like the home map, not flat UI `water`.
 */
const SEA_WASHES: { cx: number; cy: number; r: number; o: number }[] = [
  { cx: 8, cy: 16, r: 28, o: 0.42 },
  { cx: 44, cy: 12, r: 26, o: 0.38 },
  { cx: 50, cy: 42, r: 24, o: 0.4 },
  { cx: 46, cy: 72, r: 22, o: 0.36 },
  { cx: 22, cy: 90, r: 30, o: 0.4 },
  { cx: 4, cy: 58, r: 24, o: 0.34 },
  { cx: 26, cy: 48, r: 34, o: 0.18 },
  { cx: 14, cy: 30, r: 18, o: 0.28 },
];

const ROUTE_PINS = [
  {
    name: '서울',
    fx: KOREA_SILHOUETTE.pins[0].fx,
    fy: KOREA_SILHOUETTE.pins[0].fy,
    source: require('@/assets/splash/pins/seoul.png'),
  },
  {
    name: '부산',
    fx: KOREA_SILHOUETTE.pins[2].fx,
    fy: KOREA_SILHOUETTE.pins[2].fy,
    source: require('@/assets/splash/pins/busan.png'),
  },
  {
    name: '제주',
    fx: KOREA_SILHOUETTE.pins[4].fx,
    fy: KOREA_SILHOUETTE.pins[4].fy,
    source: require('@/assets/splash/pins/jeju.png'),
  },
] as const;

/**
 * Onboarding map panel — cream paper card + dawn map palette (home map tone)
 * + photo pins / dashed route.
 */
export function PaperPanelArt() {
  const palette = getMapPalette('dawn');
  const [box, setBox] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) < 1 && Math.abs(height - box.h) < 1) {
      return;
    }
    setBox({ w: width, h: height });
  };

  const layout = useMemo(() => {
    const labelReserve = LABEL_H + CARET + 12;
    const maxW = Math.max(0, box.w - PAD * 2);
    const maxH = Math.max(0, box.h - PAD * 2 - labelReserve);
    if (maxW <= 0 || maxH <= 0) {
      return { mapW: 0, mapH: 0, labelReserve };
    }
    // Contain: full Korea + Jeju visible, as large as the card allows.
    const byH = maxH;
    const byW = maxW / KOREA_SILHOUETTE.aspect;
    const mapH = Math.min(byH, byW);
    const mapW = mapH * KOREA_SILHOUETTE.aspect;
    return { mapW, mapH, labelReserve };
  }, [box.h, box.w]);

  const { mapW, mapH, labelReserve } = layout;
  const d = KOREA_SILHOUETTE.path;

  const points =
    mapW > 0
      ? ROUTE_PINS.map((p) => ({
          x: p.fx * mapW,
          y: p.fy * mapH,
          name: p.name,
          source: p.source,
        }))
      : [];

  const routeD =
    points.length >= 2
      ? catmullRomPath(points.map((p) => [p.x, p.y] as [number, number]))
      : '';

  return (
    <View style={styles.panel} onLayout={onLayout}>
      {mapW > 0 ? (
        <View
          style={[styles.mapStage, { width: mapW, height: mapH + labelReserve }]}
        >
          <Svg width={mapW} height={mapH} viewBox={KOREA_SILHOUETTE.viewBox}>
            {/* Base wash — soft sky-sea on cream, not a solid blue slab */}
            <Rect
              x={-4}
              y={-4}
              width={60}
              height={108}
              fill={palette.water}
              opacity={0.22}
            />
            {SEA_WASHES.map((wash, i) => (
              <Circle
                key={i}
                cx={wash.cx}
                cy={wash.cy}
                r={wash.r}
                fill={palette.water}
                opacity={wash.o}
              />
            ))}

            <G>
              <Path
                d={d}
                fill={palette.landShadow}
                transform="translate(0.7, 0.9)"
              />
              <Path d={d} fill={palette.landDeep} />
              <Path d={d} fill={palette.land} />
              {COAST_PASSES.map((pass) => (
                <Path
                  key={`${pass.dx}-${pass.dy}-${pass.width}`}
                  d={d}
                  fill="none"
                  stroke={palette.provinceStroke}
                  strokeOpacity={pass.opacity}
                  strokeWidth={pass.width}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  transform={
                    pass.dx === 0 && pass.dy === 0
                      ? undefined
                      : `translate(${pass.dx}, ${pass.dy})`
                  }
                />
              ))}
            </G>
          </Svg>

          {routeD ? (
            <Svg
              width={mapW}
              height={mapH}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Path
                d={routeD}
                fill="none"
                stroke={palette.provinceStroke}
                strokeWidth={1.5}
                strokeDasharray="3.5 5.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.35}
              />
            </Svg>
          ) : null}

          {points.map((p) => (
            <View
              key={p.name}
              style={[
                styles.pinWrap,
                {
                  left: p.x - PIN_R,
                  top: p.y - PIN_R - CARET * 0.25,
                  width: PIN_R * 2,
                },
              ]}
            >
              <View
                style={[
                  styles.pinRing,
                  { borderColor: palette.pinChipBg },
                ]}
              >
                <Image
                  source={p.source}
                  style={styles.pinImage}
                  contentFit="cover"
                />
              </View>
              <View
                style={[styles.caret, { borderTopColor: palette.pinChipBg }]}
              />
              <Text style={styles.pinLabel} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 280,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadows.raised,
  },
  mapStage: {
    position: 'relative',
  },
  pinWrap: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
  },
  pinRing: {
    width: PIN_R * 2,
    height: PIN_R * 2,
    borderRadius: PIN_R,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.landDeep,
    ...theme.shadows.card,
  },
  pinImage: {
    width: '100%',
    height: '100%',
  },
  caret: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: CARET * 0.7,
    borderRightWidth: CARET * 0.7,
    borderTopWidth: CARET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  pinLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: LABEL_H,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
