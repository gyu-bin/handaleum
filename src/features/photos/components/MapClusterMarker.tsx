import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { NaverMapMarkerOverlay } from '@mj-studio/react-native-naver-map';

import { theme } from '@/shared/constants/theme';

import { resolveAssetFileUri } from '../services/mediaLibrary';
import type { PlaceCluster } from '../types';

const CARD = 38;
const CARD_SELECTED = 44;
const BORDER = 2.5;
const RADIUS = 8;
const CARET_W = 12;
const CARET_H = 8;

export interface MapClusterMarkerProps {
  cluster: PlaceCluster;
  selected: boolean;
  coverAssetId?: string | null;
  onSelect: (cluster: PlaceCluster) => void;
}

/**
 * Photo map pin: paper-framed cover + teardrop tip on the geo point.
 * Custom React children (Naver snapshots the view). Remount after RN Image
 * loads so the bitmap includes the thumb — not a count caption.
 */
export function MapClusterMarker({
  cluster,
  selected,
  coverAssetId,
  onSelect,
}: MapClusterMarkerProps) {
  const cover =
    coverAssetId && cluster.photos.some((p) => p.assetId === coverAssetId)
      ? cluster.photos.find((p) => p.assetId === coverAssetId)
      : undefined;
  const display = cover ?? cluster.photos[0];
  const displayAssetId = display?.assetId;

  const cardSize = selected ? CARD_SELECTED : CARD;
  const markerW = cardSize + BORDER * 2;
  const markerH = cardSize + BORDER * 2 + CARET_H;
  const frame = selected ? theme.colors.accent : theme.colors.background;
  const tip = selected ? theme.colors.accent : theme.colors.ink;

  const [fileUri, setFileUri] = useState<string | null>(null);
  /** Remount key — Naver snapshots once on insert; flip after Image paints. */
  const [snapKey, setSnapKey] = useState(0);

  useEffect(() => {
    if (!displayAssetId) {
      setFileUri(null);
      return;
    }
    let cancelled = false;
    setSnapKey(0);
    void resolveAssetFileUri(displayAssetId).then((next) => {
      if (!cancelled) {
        setFileUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [displayAssetId]);

  // Selection changes pin chrome — re-snapshot after Image paints again.
  useEffect(() => {
    setSnapKey(0);
  }, [selected]);

  return (
    <NaverMapMarkerOverlay
      latitude={cluster.centerLat}
      longitude={cluster.centerLng}
      width={markerW}
      height={markerH}
      anchor={{ x: 0.5, y: 1 }}
      zIndex={selected ? 2 : 1}
      isHideCollidedSymbols
      onTap={() => onSelect(cluster)}
    >
      <View
        key={`${displayAssetId ?? 'x'}/${fileUri ?? ''}/${snapKey}/${selected}`}
        collapsable={false}
        style={{ width: markerW, height: markerH, alignItems: 'center' }}
      >
        <View
          style={[
            styles.card,
            {
              width: cardSize + BORDER * 2,
              height: cardSize + BORDER * 2,
              borderRadius: RADIUS,
              borderColor: frame,
              borderWidth: BORDER,
            },
          ]}
        >
          {fileUri ? (
            <Image
              source={{ uri: fileUri }}
              style={{ width: cardSize, height: cardSize }}
              resizeMode="cover"
              onLoad={() => {
                // Second snapshot after the thumb is in the layer tree.
                setSnapKey((n) => (n === 0 ? 1 : n));
              }}
            />
          ) : (
            <View style={[styles.placeholder, { width: cardSize, height: cardSize }]} />
          )}
        </View>
        <View
          style={[
            styles.caret,
            {
              borderLeftWidth: CARET_W / 2,
              borderRightWidth: CARET_W / 2,
              borderTopWidth: CARET_H,
              borderTopColor: tip,
            },
          ]}
        />
      </View>
    </NaverMapMarkerOverlay>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  placeholder: {
    backgroundColor: theme.colors.landDeep,
  },
  caret: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
