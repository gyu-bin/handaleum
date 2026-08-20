import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';

import { catmullRomPath } from '@/features/photos/utils/geo';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

const PANEL_H = 300;
const MAP_H = 228;
const PIN_R = 24;
const LABEL_H = 13;
const CARET = 6;

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

/** Soft watercolor blobs in viewBox space (around the land). */
const WATER_BLOBS: { cx: number; cy: number; r: number; o: number }[] = [
  { cx: 8, cy: 28, r: 18, o: 0.55 },
  { cx: 44, cy: 22, r: 16, o: 0.5 },
  { cx: 48, cy: 55, r: 14, o: 0.45 },
  { cx: 28, cy: 78, r: 20, o: 0.5 },
  { cx: 6, cy: 72, r: 15, o: 0.4 },
  { cx: 22, cy: 48, r: 22, o: 0.28 },
];

/**
 * Onboarding B — cream paper panel, soft water wash, photo pins + dashed route.
 */
export function PaperPanelArt() {
  const mapW = MAP_H * KOREA_SILHOUETTE.aspect;
  const d = KOREA_SILHOUETTE.path;
  const stageH = MAP_H + LABEL_H + CARET + 4;
  const padX = PIN_R + 4;

  const points = ROUTE_PINS.map((p) => ({
    x: p.fx * mapW,
    y: p.fy * MAP_H,
    name: p.name,
    source: p.source,
  }));

  const routeD = catmullRomPath(points.map((p) => [p.x, p.y] as [number, number]));

  return (
    <View style={styles.panel}>
      <View
        style={[styles.mapStage, { width: mapW + padX * 2, height: stageH }]}
      >
        <View style={[styles.mapInner, { width: mapW, height: MAP_H, left: padX }]}>
          <Svg width={mapW} height={MAP_H} viewBox={KOREA_SILHOUETTE.viewBox}>
            {WATER_BLOBS.map((blob, i) => (
              <Circle
                key={i}
                cx={blob.cx}
                cy={blob.cy}
                r={blob.r}
                fill={theme.colors.waterDeep}
                opacity={blob.o}
              />
            ))}
            <Path d={d} fill={theme.tint.faint} transform="translate(0.9, 1.1)" />
            <Path d={d} fill={theme.colors.land} />
            <Path
              d={d}
              fill="none"
              stroke={theme.colors.ink}
              strokeWidth={0.55}
              opacity={0.2}
            />
          </Svg>

          <Svg
            width={mapW}
            height={MAP_H}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Path
              d={routeD}
              fill="none"
              stroke={theme.colors.ink}
              strokeWidth={1.5}
              strokeDasharray="3.5 5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.38}
            />
          </Svg>

          {points.map((p) => (
            <View
              key={p.name}
              style={[
                styles.pinWrap,
                {
                  left: p.x - PIN_R,
                  top: p.y - PIN_R - CARET * 0.35,
                  width: PIN_R * 2,
                },
              ]}
            >
              <View style={styles.pinRing}>
                <Image
                  source={p.source}
                  style={styles.pinImage}
                  contentFit="cover"
                />
              </View>
              <View style={styles.caret} />
              <Text style={styles.pinLabel} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    height: PANEL_H,
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
  mapInner: {
    position: 'absolute',
    top: 8,
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
    borderColor: theme.colors.surface,
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
    borderTopColor: theme.colors.surface,
  },
  pinLabel: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: LABEL_H,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
