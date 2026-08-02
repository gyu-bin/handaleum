import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { startMonthImageWarmup } from '../services/monthImageWarmup';
import type { PlaceCluster, PhotoRef } from '../types';
import { placeBucketKey, resolveClusterDetailLabel } from '../utils/placeJourney';
import { useCurrentMonth } from '../hooks/useCurrentMonth';

/** Photos appended per scroll page in the pin sheet grid. */
const PAGE_SIZE = 50;

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
    void resolveAssetUri(photo.assetId)
      .then((next) => {
        if (!cancelled) {
          setUri(next);
        }
      })
      .catch((error) => {
        console.warn('PhotoThumb uri failed', photo.assetId, error);
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
        <Image
          source={{ uri }}
          style={styles.thumb}
          contentFit="cover"
          recyclingKey={photo.assetId}
          cachePolicy="memory-disk"
        />
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
  const { month } = useCurrentMonth();
  const placeKey = cluster
    ? placeBucketKey(cluster.centerLat, cluster.centerLng)
    : null;
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cluster?.id]);

  const pagePhotos = useMemo(() => {
    if (!cluster) {
      return [];
    }
    return cluster.photos.slice(0, visibleCount);
  }, [cluster, visibleCount]);

  // Warm only the visible sheet page (not the whole cluster if it has thousands).
  useEffect(() => {
    if (pagePhotos.length === 0) {
      return;
    }
    startMonthImageWarmup({
      month,
      assetIds: pagePhotos.map((p) => p.assetId),
    });
  }, [month, pagePhotos]);

  useEffect(() => {
    if (!cluster) {
      setPlaceLabel(null);
      setLabelLoading(false);
      void Image.clearMemoryCache();
      return;
    }
    let cancelled = false;
    setPlaceLabel(null);
    setLabelLoading(true);
    // Prefer a real photo coordinate over the cluster centroid (centroids can
    // sit on bridges / water between buckets and mis-alias neighborhoods).
    const pin =
      (coverAssetId
        ? cluster.photos.find((p) => p.assetId === coverAssetId)
        : undefined) ?? cluster.photos[0];
    const lat = pin?.lat ?? cluster.centerLat;
    const lng = pin?.lng ?? cluster.centerLng;
    void resolveClusterDetailLabel(lat, lng)
      .then((label) => {
        if (!cancelled) {
          setPlaceLabel(label);
          setLabelLoading(false);
        }
      })
      .catch((error) => {
        console.warn('resolveClusterDetailLabel failed', error);
        if (!cancelled) {
          setPlaceLabel(null);
          setLabelLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cluster, coverAssetId]);

  const loadMore = useCallback(() => {
    if (!cluster) {
      return;
    }
    setVisibleCount((n) =>
      n >= cluster.photos.length
        ? n
        : Math.min(n + PAGE_SIZE, cluster.photos.length),
    );
  }, [cluster]);

  const titleText = labelLoading
    ? strings.map.placeLoading
    : (placeLabel ??
      (cluster ? strings.map.clusterCount(cluster.photos.length) : ''));

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
              {titleText}
            </Text>
            {cluster && !labelLoading && placeLabel ? (
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
            data={pagePhotos}
            keyExtractor={(item) => item.assetId}
            numColumns={3}
            contentContainerStyle={styles.list}
            initialNumToRender={PAGE_SIZE}
            maxToRenderPerBatch={12}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
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
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  meta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.serif,
    color: theme.colors.inkSoft,
  },
  close: {
    ...theme.type.body,
    fontFamily: theme.fonts.serif,
    color: theme.colors.terracotta,
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
    backgroundColor: theme.colors.terracotta,
  },
  coverBadgeText: {
    color: theme.colors.surface,
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
    color: theme.colors.surface,
    fontSize: 9,
    fontWeight: '600',
  },
});
