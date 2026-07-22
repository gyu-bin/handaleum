import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { PaperMap } from '../../photos/components/PaperMap';
import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { RecapCardDraft } from '../types';
import { cardCoordinate, formatMonthDot } from '../utils/cardMeta';

/** Design width the fixed sizes below are authored against. */
const BASE_WIDTH = 360;
const OUTER_PAD = 18;
const FRAME_PAD = 18;

/**
 * Feed card (1080×1350, 4:5) in the Dawn Survey language: cream paper, a thin
 * registration frame, the paper map as the hero, a filmstrip of up to three
 * photos, and instrument-style annotations (coordinate, month, sand tick).
 */
export function CardTemplateFeed({ card, width = BASE_WIDTH }: CardTemplateFeedProps) {
  const s = width / BASE_WIDTH;
  const styles = useMemo(() => makeStyles(width), [width]);
  const photos = card.photoRefs.slice(0, 3);
  const photoIds = photos.map((p) => p.assetId).join('|');
  const [uris, setUris] = useState<(string | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ids = photoIds.length > 0 ? photoIds.split('|') : [];
    void Promise.all(ids.map((id) => resolveAssetUri(id))).then((next) => {
      if (!cancelled) {
        setUris(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photoIds]);

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

        <View style={styles.mapWrap}>
          <PaperMap pins={pins} width={mapW} height={mapW * 0.62} />
        </View>

        <View style={styles.strip}>
          {photos.map((photo, index) => (
            <View key={photo.assetId} style={styles.cell}>
              {uris[index] ? (
                <Image
                  source={{ uri: uris[index]! }}
                  style={styles.image}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.image, styles.placeholder]} />
              )}
            </View>
          ))}
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

export interface CardTemplateFeedProps {
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
      aspectRatio: 1080 / 1350,
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
    mapWrap: {
      borderRadius: 3 * s,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    strip: {
      flexDirection: 'row',
      gap: 6 * s,
    },
    cell: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 2 * s,
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
    titleBlock: {
      marginTop: 2 * s,
      gap: 4 * s,
    },
    title: {
      fontFamily: theme.fonts.serif,
      color: theme.colors.ink,
      fontSize: 27 * s,
      fontWeight: '700',
      letterSpacing: -0.6 * s,
    },
    comment: {
      color: theme.colors.inkSoft,
      fontSize: 13 * s,
      lineHeight: 19 * s,
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
