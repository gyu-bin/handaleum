import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import type { RecapCardDraft } from '../types';
import {
  resolvePaperSkin,
  type PaperSkinTone,
} from '../constants/paperSkins';
import { formatMonthDot } from '../utils/cardMeta';
import { CardCollage } from './CardCollage';

/** Design width the fixed sizes below are authored against. */
const BASE_WIDTH = 360;
const OUTER_PAD = 18;
const FRAME_PAD = 18;

/**
 * Feed card (1080×1350, 4:5): paper skin + photo collage (up to 5), title.
 */
export function CardTemplateFeed({ card, width = BASE_WIDTH }: CardTemplateFeedProps) {
  const s = width / BASE_WIDTH;
  const skin = resolvePaperSkin(card.paperSkin);
  const styles = useMemo(() => makeStyles(width, skin), [width, skin]);
  const [heroBox, setHeroBox] = useState<{ w: number; h: number } | null>(null);
  const monthLabel = formatMonthDot(card.month);
  const comment = card.comment.trim();

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.titleTop} numberOfLines={1}>
            {card.title}
          </Text>
          <Text style={styles.brand}>한달음</Text>
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
              gutter={6 * s}
              radius={2 * s}
            />
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          {comment ? (
            <View style={styles.commentStrip}>
              <Text style={styles.comment} numberOfLines={1}>
                {comment}
              </Text>
            </View>
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

export interface CardTemplateFeedProps {
  card: RecapCardDraft;
  /** Render width in points. Everything scales from it so the card composes
   *  identically at preview size and at export size (see cardExport). */
  width?: number;
}

function makeStyles(width: number, skin: PaperSkinTone) {
  const s = width / BASE_WIDTH;
  return StyleSheet.create({
    root: {
      width,
      aspectRatio: 1080 / 1350,
      backgroundColor: skin.paper,
      padding: OUTER_PAD * s,
    },
    frame: {
      flex: 1,
      borderWidth: 1,
      borderColor: skin.line,
      padding: FRAME_PAD * s,
      gap: 12 * s,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleTop: {
      flex: 1,
      marginRight: 8 * s,
      fontFamily: theme.fonts.serif,
      color: skin.ink,
      fontSize: 15 * s,
      fontWeight: '700',
      letterSpacing: -0.3 * s,
    },
    brand: {
      color: skin.inkSoft,
      fontSize: 11 * s,
      fontWeight: '700',
      letterSpacing: 3 * s,
    },
    rule: {
      height: 1,
      backgroundColor: skin.line,
    },
    hero: {
      flex: 1,
      overflow: 'hidden',
    },
    titleBlock: {
      marginTop: 2 * s,
      gap: 6 * s,
    },
    commentStrip: {
      backgroundColor: skin.commentStrip,
      borderRadius: 6 * s,
      paddingHorizontal: 10 * s,
      paddingVertical: 7 * s,
    },
    comment: {
      color: skin.inkSoft,
      fontSize: 13 * s,
      lineHeight: 18 * s,
    },
    footer: {
      marginTop: 'auto',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6 * s,
    },
    tick: {
      width: 9 * s,
      height: 9 * s,
      backgroundColor: skin.inkSoft,
    },
    month: {
      color: skin.ink,
      fontSize: 12 * s,
      fontWeight: '600',
      letterSpacing: 0.5 * s,
    },
    unit: {
      color: skin.subtle,
      fontSize: 9 * s,
      letterSpacing: 2 * s,
    },
  });
}
