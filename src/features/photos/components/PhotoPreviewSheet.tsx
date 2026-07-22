import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { resolveAssetUri } from '../services/mediaLibrary';
import type { PlaceCluster, PhotoRef } from '../types';
import { placeBucketKey, resolveClusterDetailLabel } from '../utils/placeJourney';

export interface PhotoPreviewSheetProps {
  /** null closes the sheet */
  cluster: PlaceCluster | null;
  onClose: () => void;
  /** Currently selected cover asset for this place bucket. */
  coverAssetId?: string | null;
  /** Set cover for the cluster's place bucket. */
  onSetCover?: (placeKey: string, assetId: string) => void;
}

function PhotoThumb({
  photo,
  isCover,
  onSelectCover,
}: {
  photo: PhotoRef;
  isCover: boolean;
  onSelectCover?: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const size = (width - theme.spacing.md * 2 - theme.spacing.sm * 2) / 3;

  useEffect(() => {
    let cancelled = false;
    void resolveAssetUri(photo.assetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [photo.assetId]);

  return (
    <Pressable
      onLongPress={onSelectCover}
      onPress={onSelectCover}
      disabled={!onSelectCover}
      accessibilityRole="button"
      accessibilityLabel={
        isCover
          ? strings.map.coverSelected
          : strings.map.setAsCover
      }
      style={{ width: size, height: size, margin: theme.spacing.sm / 2 }}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      {isCover ? (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>{strings.map.coverBadge}</Text>
        </View>
      ) : onSelectCover ? (
        <View style={styles.coverHint}>
          <Text style={styles.coverHintText}>{strings.map.setAsCoverShort}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function PhotoPreviewSheet({
  cluster,
  onClose,
  coverAssetId,
  onSetCover,
}: PhotoPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const placeKey = cluster
    ? placeBucketKey(cluster.centerLat, cluster.centerLng)
    : null;
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!cluster) {
      setPlaceLabel(null);
      return;
    }
    let cancelled = false;
    setPlaceLabel(null);
    void resolveClusterDetailLabel(cluster.centerLat, cluster.centerLng).then(
      (label) => {
        if (!cancelled) {
          setPlaceLabel(label);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cluster]);

  return (
    <Modal
      visible={cluster != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { paddingTop: insets.top + theme.spacing.md }]}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {placeLabel ??
                (cluster ? strings.map.clusterCount(cluster.photos.length) : '')}
            </Text>
            {cluster && placeLabel ? (
              <Text style={styles.meta} numberOfLines={1}>
                {strings.map.clusterCount(cluster.photos.length)}
              </Text>
            ) : null}
            {onSetCover ? (
              <Text style={styles.meta}>{strings.map.coverHint}</Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={styles.close}>{strings.common.confirm}</Text>
          </Pressable>
        </View>
        {cluster ? (
          <FlatList
            data={cluster.photos}
            keyExtractor={(item) => item.assetId}
            numColumns={3}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <PhotoThumb
                photo={item}
                isCover={coverAssetId === item.assetId}
                onSelectCover={
                  onSetCover && placeKey
                    ? () => onSetCover(placeKey, item.assetId)
                    : undefined
                }
              />
            )}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...theme.type.title,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  meta: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
  },
  close: {
    ...theme.type.body,
    color: theme.colors.accent,
    fontWeight: '600',
    marginTop: 2,
  },
  list: {
    paddingHorizontal: theme.spacing.md - theme.spacing.sm / 2,
    paddingBottom: theme.spacing.xl,
  },
  thumb: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  thumbPlaceholder: {
    backgroundColor: theme.colors.ink,
    opacity: 0.12,
  },
  coverBadge: {
    position: 'absolute',
    left: 4,
    top: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  coverBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  coverHint: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.overlayDark,
  },
  coverHintText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: '600',
  },
});
