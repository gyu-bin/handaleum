import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../services/mediaLibrary';
import type { PlaceCluster } from '../types';
import type { MapDetail } from './MapSvg';

/** Small photo markers — readable, not larger than a district name. */
const CARD_BY_DETAIL: Record<MapDetail, number> = {
  overview: 20,
  region: 22,
  local: 24,
};
const BORDER = 1.5;
const RADIUS = 5;
const CARET_W = 7;
const CARET_H = 5;

export interface ClusterPinProps {
  cluster: PlaceCluster;
  selected: boolean;
  onPress: (cluster: PlaceCluster) => void;
  detail?: MapDetail;
  /** Preferred cover when it belongs to this cluster. */
  coverAssetId?: string | null;
  /**
   * When false, render a non-pressable glyph for MapView Marker
   * (parent Marker owns the hit target).
   */
  interactive?: boolean;
}

/**
 * Quiet photo pin: small rounded thumbnail + paper frame + tip on the geo point.
 * Place names stay as admin labels on the map — no chip under the pin.
 */
export function ClusterPin({
  cluster,
  selected,
  onPress,
  detail = 'overview',
  coverAssetId,
  interactive = true,
}: ClusterPinProps) {
  const [uri, setUri] = useState<string | null>(null);
  const cover =
    coverAssetId && cluster.photos.some((p) => p.assetId === coverAssetId)
      ? cluster.photos.find((p) => p.assetId === coverAssetId)
      : undefined;
  const display = cover ?? cluster.photos[0];
  const displayAssetId = display?.assetId;
  const count = cluster.photos.length;
  const size = CARD_BY_DETAIL[detail];
  const frame = selected ? theme.colors.ink : theme.colors.inkSoft;
  const tipFill = selected ? theme.colors.ink : theme.colors.inkSoft;

  useEffect(() => {
    if (!displayAssetId) {
      setUri(null);
      return;
    }
    let cancelled = false;
    void resolveAssetUri(displayAssetId)
      .then((next) => {
        if (!cancelled) {
          setUri(next);
        }
      })
      .catch((error) => {
        console.warn('ClusterPin uri failed', displayAssetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [displayAssetId]);

  const body = (
    <>
      <View
        style={[
          styles.marker,
          {
            width: size,
            marginTop: interactive ? -(size + CARET_H) : 0,
          },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              width: size,
              height: size,
              borderRadius: RADIUS,
              borderColor: frame,
            },
          ]}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.thumb}
              contentFit="cover"
              recyclingKey={displayAssetId}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]} />
          )}
          {count > 1 ? (
            <View style={styles.countBadge}>
              <Text style={styles.count} numberOfLines={1}>
                {count > 99 ? '99+' : String(count)}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.caret,
            {
              borderLeftWidth: CARET_W / 2,
              borderRightWidth: CARET_W / 2,
              borderTopWidth: CARET_H,
              borderTopColor: tipFill,
            },
          ]}
        />
      </View>
    </>
  );

  if (!interactive) {
    return <View style={styles.wrap}>{body}</View>;
  }

  return (
    <Pressable
      onPress={() => onPress(cluster)}
      accessibilityRole="button"
      accessibilityLabel={`사진 ${count}장`}
      hitSlop={10}
      style={styles.wrap}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  marker: {
    alignItems: 'center',
  },
  card: {
    borderWidth: BORDER,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
    shadowColor: theme.colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.landDeep,
  },
  caret: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  countBadge: {
    position: 'absolute',
    right: 1,
    top: 1,
    minWidth: 12,
    paddingHorizontal: 2,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: theme.colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    alignItems: 'center',
  },
  count: {
    fontSize: 7,
    fontWeight: '700',
    color: theme.colors.ink,
  },
});
