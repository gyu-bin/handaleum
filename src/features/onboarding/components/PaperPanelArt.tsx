import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { getMapPalette } from '@/shared/constants/mapThemes';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

import { PaperMapSvg } from './PaperMapSvg';

/** Inset between the sheet edge and the map. */
const PAD = 16;

/** Card geometry as fractions of the card's own width (from the design plate). */
const CARD_PAD_RATIO = 0.068;
const CARD_CAP_RATIO = 0.243;
const CARD_W_RATIO = 0.212;
const CARD_W_MIN = 54;
const CARD_W_MAX = 86;

/**
 * Photo places. `pin` indexes `KOREA_SILHOUETTE.pins`
 * ([서울, 강릉, 부산, 광주, 제주]); `card` is the print's top-left corner as a
 * fraction of the panel, laid out so no two prints and no print and the
 * landmass collide. Add 대전 here once its pin photo exists.
 */
const PLACES = [
  {
    name: '서울',
    pin: 0,
    rotate: '-4deg',
    card: { x: 0.012, y: 0.086 },
    source: require('@/assets/splash/pins/seoul.png'),
  },
  {
    name: '강릉',
    pin: 1,
    rotate: '2.2deg',
    card: { x: 0.74, y: 0.072 },
    source: require('@/assets/splash/pins/gangneung.png'),
  },
  {
    name: '광주',
    pin: 3,
    rotate: '-2.6deg',
    card: { x: 0.012, y: 0.54 },
    source: require('@/assets/splash/pins/gwangju.png'),
  },
  {
    name: '부산',
    pin: 2,
    rotate: '3.4deg',
    card: { x: 0.775, y: 0.47 },
    source: require('@/assets/splash/pins/busan.png'),
  },
  {
    name: '제주',
    pin: 4,
    rotate: '-2deg',
    card: { x: 0.47, y: 0.78 },
    source: require('@/assets/splash/pins/jeju.png'),
  },
] as const;

/**
 * Onboarding map sheet — one sheet of paper map, with the photos that made it
 * pinned around the edge and tied to their coordinates by a hairline.
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
    const maxW = Math.max(0, box.w - PAD * 2);
    const maxH = Math.max(0, box.h - PAD * 2);
    if (maxW <= 0 || maxH <= 0) {
      return null;
    }
    // Contain: the whole peninsula plus Jeju, as large as the sheet allows.
    const mapH = Math.min(maxH, maxW / KOREA_SILHOUETTE.aspect);
    const mapW = mapH * KOREA_SILHOUETTE.aspect;
    const mapX = (box.w - mapW) / 2;
    const mapY = (box.h - mapH) / 2;
    const cardW = Math.min(
      CARD_W_MAX,
      Math.max(CARD_W_MIN, box.w * CARD_W_RATIO),
    );
    const cardPad = Math.round(cardW * CARD_PAD_RATIO);
    const photo = cardW - cardPad * 2;
    const capH = Math.round(cardW * CARD_CAP_RATIO);
    return {
      mapW,
      mapH,
      mapX,
      mapY,
      /** px per viewBox unit — hairlines are divided by this. */
      scale: mapW / 51.9,
      cardW,
      cardPad,
      photo,
      cardH: cardPad + photo + capH,
    };
  }, [box.h, box.w]);

  const places = useMemo(() => {
    if (!layout) {
      return [];
    }
    return PLACES.map((place) => {
      const pin = KOREA_SILHOUETTE.pins[place.pin];
      const dot = {
        x: layout.mapX + pin.fx * layout.mapW,
        y: layout.mapY + pin.fy * layout.mapH,
      };
      const card = {
        x: place.card.x * box.w,
        y: place.card.y * box.h,
      };
      // Leader starts on whichever card edge faces the dot.
      const fromRight = dot.x > card.x + layout.cardW / 2;
      return {
        ...place,
        dot,
        card,
        leader: {
          x: card.x + (fromRight ? layout.cardW : 0),
          y: card.y + layout.cardH * 0.55,
        },
      };
    });
  }, [box.h, box.w, layout]);

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: palette.water, borderColor: palette.frameBorder },
      ]}
      onLayout={onLayout}
    >
      {layout ? (
        <>
          <View
            style={[
              styles.mapStage,
              {
                left: layout.mapX,
                top: layout.mapY,
                width: layout.mapW,
                height: layout.mapH,
              },
            ]}
          >
            <PaperMapSvg
              width={layout.mapW}
              height={layout.mapH}
              scale={layout.scale}
            />
          </View>

          <Svg
            width={box.w}
            height={box.h}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {places.map((place) => (
              <Path
                key={place.name}
                d={`M${place.leader.x},${place.leader.y} L${place.dot.x},${place.dot.y}`}
                stroke={theme.colors.ink}
                strokeOpacity={0.38}
                strokeWidth={0.9}
              />
            ))}
          </Svg>

          <Text
            style={[
              styles.sea,
              { right: box.w * 0.063, top: box.h * 0.38 },
            ]}
          >
            동해
          </Text>
          <Text
            style={[
              styles.sea,
              { left: box.w * 0.785, bottom: box.h * 0.063 },
            ]}
          >
            남해
          </Text>

          {places.map((place) => (
            <View
              key={`dot-${place.name}`}
              style={[
                styles.dot,
                {
                  left: place.dot.x - 6.5,
                  top: place.dot.y - 6.5,
                  borderColor: palette.pinChipBg,
                },
              ]}
            />
          ))}

          {places.map((place) => (
            <View
              key={`card-${place.name}`}
              style={[
                styles.card,
                {
                  left: place.card.x,
                  top: place.card.y,
                  width: layout.cardW,
                  padding: layout.cardPad,
                  paddingBottom: 0,
                  transform: [{ rotate: place.rotate }],
                },
              ]}
            >
              <Image
                source={place.source}
                style={{ width: layout.photo, height: layout.photo }}
                contentFit="cover"
              />
              <Text style={styles.cardLabel} numberOfLines={1}>
                {place.name}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    width: '100%',
    minHeight: 260,
    // Paper is cut, not rounded — the sheet reads as a sheet.
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...theme.shadows.raised,
  },
  mapStage: {
    position: 'absolute',
  },
  sea: {
    position: 'absolute',
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
    letterSpacing: 3,
    color: theme.tint.mid,
    zIndex: 1,
  },
  /** 8px ink core inside a cream ring — RN draws borders inward, so the box is core + ring. */
  dot: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2.5,
    backgroundColor: theme.colors.ink,
    zIndex: 2,
  },
  card: {
    position: 'absolute',
    backgroundColor: theme.colors.surface,
    borderRadius: 2,
    zIndex: 3,
    ...theme.shadows.card,
  },
  cardLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: theme.colors.inkSoft,
    paddingTop: 3,
    paddingBottom: 4,
  },
});
