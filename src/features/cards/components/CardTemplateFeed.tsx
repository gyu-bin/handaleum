import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { PaperMap } from '../../photos/components/PaperMap';
import { resolveAssetUri } from '../../photos/services/mediaLibrary';
import type { RecapCardDraft } from '../types';

export interface CardTemplateFeedProps {
  card: RecapCardDraft;
}

/**
 * Feed card: paper map on top (~55%) + photo strip + title.
 * Capture target: 1080×1350 feel via aspectRatio.
 */
export function CardTemplateFeed({ card }: CardTemplateFeedProps) {
  const photos = card.photoRefs.slice(0, 4);
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

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <PaperMap pins={pins} width={328} height={180} />
      </View>

      <View style={styles.grid}>
        {photos.map((photo, index) => (
          <View key={photo.assetId} style={styles.cell}>
            {uris[index] ? (
              <Image source={{ uri: uris[index]! }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={[styles.image, styles.placeholder]} />
            )}
          </View>
        ))}
      </View>

      <Text style={styles.title}>{card.title}</Text>
      {card.comment ? <Text style={styles.comment}>{card.comment}</Text> : null}
      <Text style={styles.month}>{card.month}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 360,
    aspectRatio: 1080 / 1350,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  mapWrap: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    minHeight: 72,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.ink,
  },
  placeholder: {
    opacity: 0.12,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  comment: {
    color: theme.colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  month: {
    color: theme.colors.accent,
    fontWeight: '600',
    fontSize: 13,
  },
});
