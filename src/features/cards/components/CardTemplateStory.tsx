import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import type { RecapCardDraft } from '../types';
import { cardCoordinate, formatMonthDot } from '../utils/cardMeta';
import { CardCollage } from './CardCollage';

/** Design width the fixed sizes below are authored against. */
const BASE_WIDTH = 270;
const OUTER_PAD = 8;
const FRAME_PAD = 9;

/**
 * Story card (1080×1920, 9:16): cream paper, photo collage hero (up to 5),
 * title/footer. Map strip removed — photos are the product; Instagram can't tap.
 */
export function CardTemplateStory({
  card,
  width = BASE_WIDTH,
  onReady,
}: CardTemplateStoryProps) {
  const s = width / BASE_WIDTH;
  const styles = useMemo(() => makeStyles(width), [width]);
  const [heroBox, setHeroBox] = useState<{ w: number; h: number } | null>(null);
  const [collageReady, setCollageReady] = useState(false);
  const pinsKey = card.photoRefs.map((p) => p.assetId).join('|');

  useEffect(() => {
    setCollageReady(false);
  }, [pinsKey, width]);

  useEffect(() => {
    if (heroBox && collageReady) {
      onReady?.();
    }
  }, [heroBox, collageReady, onReady]);

  const coord = cardCoordinate(card.photoRefs);
  const monthLabel = formatMonthDot(card.month);

  return (
    <View style={styles.root} collapsable={false}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.brand}>한달음</Text>
          <View style={styles.metaCol}>
            {coord ? <Text style={styles.coord}>{coord}</Text> : null}
          </View>
        </View>
        <View style={styles.rule} />

        <View
          style={styles.hero}
          onLayout={(e) => {
            const { width: w, height: h } = e.nativeEvent.layout;
            setHeroBox((prev) =>
              prev && prev.w === w && prev.h === h ? prev : { w, h },
            );
          }}
        >
          {heroBox ? (
            <CardCollage
              photos={card.photoRefs}
              width={heroBox.w}
              height={heroBox.h}
              gutter={4 * s}
              radius={3 * s}
              onReady={() => setCollageReady(true)}
            />
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          {card.comment ? (
            <Text style={styles.comment} numberOfLines={2}>
              {card.comment}
            </Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View style={styles.tickRow}>
            <View style={styles.tick} />
            <Text style={styles.month}>{monthLabel}</Text>
          </View>
          <Text style={styles.unit}>MONTHLY RECAP</Text>
        </View>
      </View>
    </View>
  );
}

export interface CardTemplateStoryProps {
  card: RecapCardDraft;
  /** Render width in points. Everything scales from it so the card composes
   *  identically at preview size and at export size (see cardExport). */
  width?: number;
  /** Fires when hero collage is laid out and images have loaded (or failed). */
  onReady?: () => void;
}

function makeStyles(width: number) {
  const s = width / BASE_WIDTH;
  return StyleSheet.create({
    root: {
      width,
      aspectRatio: 1080 / 1920,
      backgroundColor: theme.colors.background,
      padding: OUTER_PAD * s,
    },
    frame: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.tint.mid,
      padding: FRAME_PAD * s,
      gap: 4 * s,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    brand: {
      color: theme.colors.inkSoft,
      fontSize: 10 * s,
      fontWeight: '700',
      letterSpacing: 2.5 * s,
    },
    metaCol: {
      flexShrink: 1,
      alignItems: 'flex-end',
      gap: 1 * s,
      maxWidth: width * 0.58,
    },
    coord: {
      color: theme.colors.subtle,
      fontSize: 7.5 * s,
      letterSpacing: 0.5 * s,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.tint.soft,
    },
    hero: {
      flex: 1,
      overflow: 'hidden',
    },
    titleBlock: {
      gap: 3 * s,
    },
    title: {
      fontFamily: theme.fonts.serif,
      color: theme.colors.ink,
      fontSize: 17 * s,
      fontWeight: '700',
      letterSpacing: -0.4 * s,
    },
    comment: {
      color: theme.colors.inkSoft,
      fontSize: 10 * s,
      lineHeight: 14 * s,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5 * s,
    },
    tick: {
      width: 7 * s,
      height: 7 * s,
      backgroundColor: theme.colors.sand,
    },
    month: {
      color: theme.colors.ink,
      fontSize: 11 * s,
      fontWeight: '600',
      letterSpacing: 0.4 * s,
    },
    unit: {
      color: theme.colors.subtle,
      fontSize: 8 * s,
      letterSpacing: 1.6 * s,
    },
  });
}
