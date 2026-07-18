import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { PaperMap } from '../../photos/components/PaperMap';
import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { RecapCardDraft } from '../types';

export interface CardTemplateStoryProps {
  card: RecapCardDraft;
}

/**
 * Story card: hero photo + paper map strip + title overlay.
 */
export function CardTemplateStory({ card }: CardTemplateStoryProps) {
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

  return (
    <View style={styles.root}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]} />
      )}
      <View style={styles.mapStrip}>
        <PaperMap pins={pins} width={270} height={140} />
      </View>
      <View style={styles.overlay}>
        <Text style={styles.title}>{card.title}</Text>
        {card.comment ? <Text style={styles.comment}>{card.comment}</Text> : null}
        <Text style={styles.month}>{card.month}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 270,
    aspectRatio: 1080 / 1920,
    backgroundColor: theme.colors.ink,
    overflow: 'hidden',
    borderRadius: 8,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholder: {
    backgroundColor: theme.colors.ink,
    opacity: 0.3,
  },
  mapStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '42%',
    alignItems: 'center',
    opacity: 0.97,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.overlayDark,
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.background,
    fontSize: 20,
    fontWeight: '700',
  },
  comment: {
    color: theme.colors.background,
    opacity: 0.9,
    fontSize: 13,
    lineHeight: 18,
  },
  month: {
    color: theme.colors.landLight,
    fontWeight: '600',
    fontSize: 12,
  },
});
