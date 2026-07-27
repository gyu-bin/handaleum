import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import { PaperMap } from '../../photos/components/PaperMap';
import {
  resolveCardPinPlaces,
  type CardPinPlace,
} from '../../photos/utils/placeJourney';
import type { RecapCardDraft } from '../types';
import { cardCoordinate, formatMonthDot } from '../utils/cardMeta';
import { CardCollage } from './CardCollage';

/** Design width the fixed sizes below are authored against. */
const BASE_WIDTH = 270;
const OUTER_PAD = 8;
const FRAME_PAD = 9;
/** Map strip height as a fraction of content width — a thin, quiet locator band. */
const MAP_HEIGHT_RATIO = 0.26;

/**
 * Story card (1080×1920, 9:16) in the Dawn Survey language: cream paper with a
 * registration frame, a framed hero photo, the paper map, and instrument-style
 * annotations. Same family as the feed card, taller composition.
 */
export function CardTemplateStory({ card, width = BASE_WIDTH }: CardTemplateStoryProps) {
  const s = width / BASE_WIDTH;
  const styles = useMemo(() => makeStyles(width), [width]);
  const [places, setPlaces] = useState<CardPinPlace[]>([]);
  // The collage fills the leftover vertical space (measured) so the card has no
  // dead space under the footer and the photos stay as large as the frame allows.
  const [heroBox, setHeroBox] = useState<{ w: number; h: number } | null>(null);
  const pinsKey = card.photoRefs
    .map((p) => `${p.assetId}:${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    void resolveCardPinPlaces(card.photoRefs).then((next) => {
      if (!cancelled) {
        setPlaces(next);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pinsKey captures photo set
  }, [pinsKey]);

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
            />
          ) : null}
        </View>

        <View style={styles.mapWrap}>
          <PaperMap
            pins={pins}
            width={mapW}
            height={mapW * MAP_HEIGHT_RATIO}
            places={places}
          />
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
      gap: 6 * s,
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
    mapWrap: {
      borderRadius: 3 * s,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.tint.soft,
      opacity: 0.88,
    },
    titleBlock: {
      gap: 3 * s,
    },
    title: {
      fontFamily: theme.fonts.serif,
      color: theme.colors.ink,
      fontSize: 20 * s,
      fontWeight: '700',
      letterSpacing: -0.4 * s,
    },
    comment: {
      color: theme.colors.inkSoft,
      fontSize: 11 * s,
      lineHeight: 15 * s,
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
