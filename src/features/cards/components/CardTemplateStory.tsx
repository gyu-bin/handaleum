import { useEffect, useMemo, useState } from 'react';
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
const BASE_WIDTH = 270;
const OUTER_PAD = 8;
const FRAME_PAD = 9;

/**
 * Story card (1080×1920, 9:16): paper skin + photo collage hero (up to 5),
 * title / one-line comment / footer.
 */
export function CardTemplateStory({
  card,
  width = BASE_WIDTH,
  onReady,
}: CardTemplateStoryProps) {
  const s = width / BASE_WIDTH;
  const skin = resolvePaperSkin(card.paperSkin);
  const styles = useMemo(() => makeStyles(width, skin), [width, skin]);
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

  const monthLabel = formatMonthDot(card.month);
  const comment = card.comment.trim();

  return (
    <View style={styles.root} collapsable={false}>
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
              gutter={4 * s}
              radius={3 * s}
              onReady={() => setCollageReady(true)}
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

export interface CardTemplateStoryProps {
  card: RecapCardDraft;
  /** Render width in points. Everything scales from it so the card composes
   *  identically at preview size and at export size (see cardExport). */
  width?: number;
  /** Fires when hero collage is laid out and images have loaded (or failed). */
  onReady?: () => void;
}

function makeStyles(width: number, skin: PaperSkinTone) {
  const s = width / BASE_WIDTH;
  return StyleSheet.create({
    root: {
      width,
      aspectRatio: 1080 / 1920,
      backgroundColor: skin.paper,
      padding: OUTER_PAD * s,
    },
    frame: {
      flex: 1,
      borderWidth: 1,
      borderColor: skin.line,
      padding: FRAME_PAD * s,
      gap: 4 * s,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleTop: {
      flex: 1,
      marginRight: 6 * s,
      fontFamily: theme.fonts.serif,
      color: skin.ink,
      fontSize: 12 * s,
      fontWeight: '700',
      letterSpacing: -0.2 * s,
    },
    brand: {
      color: skin.inkSoft,
      fontSize: 10 * s,
      fontWeight: '700',
      letterSpacing: 2.5 * s,
    },
    rule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: skin.line,
    },
    hero: {
      flex: 1,
      overflow: 'hidden',
    },
    titleBlock: {
      gap: 4 * s,
    },
    commentStrip: {
      backgroundColor: skin.commentStrip,
      borderRadius: 4 * s,
      paddingHorizontal: 8 * s,
      paddingVertical: 5 * s,
    },
    comment: {
      color: skin.inkSoft,
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
      backgroundColor: skin.inkSoft,
    },
    month: {
      color: skin.ink,
      fontSize: 11 * s,
      fontWeight: '600',
      letterSpacing: 0.4 * s,
    },
    unit: {
      color: skin.subtle,
      fontSize: 8 * s,
      letterSpacing: 1.6 * s,
    },
  });
}
