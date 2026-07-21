import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { PaperMap } from '../../photos/components/PaperMap';
import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { RecapCardDraft } from '../types';
import { cardCoordinate, formatMonthDot } from '../utils/cardMeta';

/** Design width the fixed sizes below are authored against. */
const BASE_WIDTH = 270;
const OUTER_PAD = 15;
const FRAME_PAD = 16;

/**
 * Story card (1080×1920, 9:16) in the Dawn Survey language: cream paper with a
 * registration frame, a framed hero photo, the paper map, and instrument-style
 * annotations. Same family as the feed card, taller composition.
 */
export function CardTemplateStory({ card, width = BASE_WIDTH }: CardTemplateStoryProps) {
  const s = width / BASE_WIDTH;
  const styles = useMemo(() => makeStyles(width), [width]);
  const hero = card.photoRefs[0];
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!hero) {
      return;
    }
    let cancelled = false;
    void resolveAssetUri(hero.assetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hero]);

  const pins = useMemo(
    () =>
      card.photoRefs.map((photo) => ({
        id: photo.assetId,
        lat: photo.lat,
        lng: photo.lng,
      })),
    [card.photoRefs],
  );

  const mapW = width - 2 * (OUTER_PAD + FRAME_PAD) * s;
  const coord = cardCoordinate(card.photoRefs);
  const monthLabel = formatMonthDot(card.month);

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Text style={styles.brand}>한달음</Text>
          <Text style={styles.coord}>{coord}</Text>
        </View>
        <View style={styles.rule} />

        <View style={styles.hero}>
          {uri ? (
            <Image source={{ uri }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
        </View>

        <View style={styles.mapWrap}>
          <PaperMap pins={pins} width={mapW} height={mapW * 0.72} />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {card.title}
          </Text>
          {card.comment ? (
            <Text style={styles.comment} numberOfLines={3}>
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
      gap: 12 * s,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    brand: {
      color: theme.colors.inkSoft,
      fontSize: 11 * s,
      fontWeight: '700',
      letterSpacing: 3 * s,
    },
    coord: {
      color: theme.colors.subtle,
      fontSize: 9.5 * s,
      letterSpacing: 0.8 * s,
    },
    rule: {
      height: 1,
      backgroundColor: theme.tint.soft,
    },
    hero: {
      flex: 1,
      borderRadius: 3 * s,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    image: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.surfaceAlt,
    },
    placeholder: {
      opacity: 0.5,
    },
    mapWrap: {
      borderRadius: 3 * s,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    titleBlock: {
      marginTop: 2 * s,
      gap: 5 * s,
    },
    title: {
      fontFamily: theme.fonts.serif,
      color: theme.colors.ink,
      fontSize: 26 * s,
      fontWeight: '700',
      letterSpacing: -0.6 * s,
    },
    comment: {
      color: theme.colors.inkSoft,
      fontSize: 13 * s,
      lineHeight: 19 * s,
    },
    footer: {
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
      backgroundColor: theme.colors.sand,
    },
    month: {
      color: theme.colors.ink,
      fontSize: 12 * s,
      fontWeight: '600',
      letterSpacing: 0.5 * s,
    },
    unit: {
      color: theme.colors.subtle,
      fontSize: 9 * s,
      letterSpacing: 2 * s,
    },
  });
}
