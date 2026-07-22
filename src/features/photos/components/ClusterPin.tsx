import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../services/mediaLibrary';
import type { PlaceCluster } from '../types';

/** Photo card edge length (reference-style square pin). */
const CARD = 52;
const CARD_RADIUS = 11;
const BORDER = 2.5;
const CARET_W = 13;
const CARET_H = 8;
const TOTAL_H = CARD + CARET_H;

export interface ClusterPinProps {
  cluster: PlaceCluster;
  selected: boolean;
  onPress: (cluster: PlaceCluster) => void;
  /** Preferred cover asset id when it belongs to this cluster. */
  coverAssetId?: string | null;
}

/**
 * Reference-style map pin: square photo card + white frame + bottom caret.
 * Tip of the caret sits on the geo point (MapAnchor centers this view).
 */
export function ClusterPin({
  cluster,
  selected,
  onPress,
  coverAssetId,
}: ClusterPinProps) {
  const [uri, setUri] = useState<string | null>(null);
  const cover =
    coverAssetId && cluster.photos.some((p) => p.assetId === coverAssetId)
      ? cluster.photos.find((p) => p.assetId === coverAssetId)
      : undefined;
  const display = cover ?? cluster.photos[0];
  const displayAssetId = display?.assetId;
  const count = cluster.photos.length;
  const frameColor = selected ? theme.colors.accent : theme.colors.white;

  useEffect(() => {
    if (!displayAssetId) {
      setUri(null);
      return;
    }
    let cancelled = false;
    void resolveAssetUri(displayAssetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [displayAssetId]);

  return (
    <Pressable
      onPress={() => onPress(cluster)}
      accessibilityRole="button"
      accessibilityLabel={`${count} photos`}
      hitSlop={8}
      style={[styles.wrap, selected && styles.wrapSelected]}
    >
      <View style={[styles.card, { borderColor: frameColor }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        {count > 1 ? (
          <View style={styles.countChip}>
            <Text style={styles.count} numberOfLines={1}>
              {count.toLocaleString('ko-KR')}
            </Text>
          </View>
        ) : null}
      </View>
      <View
        style={[
          styles.caret,
          {
            borderTopColor: frameColor,
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    // MapAnchor centers this box; shift up so the caret tip lands on the point.
    transform: [{ translateY: -(TOTAL_H / 2) }],
    ...theme.shadows.card,
  },
  wrapSelected: {
    ...theme.shadows.raised,
  },
  card: {
    width: CARD,
    height: CARD,
    borderRadius: CARD_RADIUS,
    borderWidth: BORDER,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.landDeep,
  },
  countChip: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.overlayDark,
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: theme.colors.white,
  },
  caret: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: CARET_W / 2,
    borderRightWidth: CARET_W / 2,
    borderTopWidth: CARET_H,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
