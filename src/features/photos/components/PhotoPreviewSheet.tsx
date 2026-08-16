import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { AssetThumbImage } from './AssetThumbImage';
import { usePauseGridThumbWarmOnScroll } from '../hooks/usePauseGridThumbWarmOnScroll';
import { warmGridThumbs } from '../services/mediaLibrary';
import type { PlaceCluster, PhotoRef } from '../types';
import { placeBucketKey, resolveClusterDetailLabel } from '../utils/placeJourney';
import { peekResolvedPlace } from '../services/placeResolve';

/** Photos appended per scroll page in the pin sheet grid. */
const PAGE_SIZE = 18;

export interface PhotoPreviewSheetProps {
  /** null closes the sheet */
  cluster: PlaceCluster | null;
  onClose: () => void;
  /** Currently selected cover asset for this place bucket. */
  coverAssetId?: string | null;
  /** Set cover for the cluster's place bucket. */
  onSetCover?: (placeKey: string, assetId: string) => void;
}

const PhotoThumb = memo(function PhotoThumb({
  photo,
  size,
  isCover,
  onSelectCover,
}: {
  photo: PhotoRef;
  size: number;
  isCover: boolean;
  onSelectCover?: () => void;
}) {
  return (
    <Pressable
      onLongPress={onSelectCover}
      onPress={onSelectCover}
      disabled={!onSelectCover}
      accessibilityRole="button"
      accessibilityLabel={
        isCover ? strings.map.coverSelected : strings.map.setAsCover
      }
      style={{ width: size, height: size, margin: theme.spacing.sm / 2 }}
    >
      <AssetThumbImage
        assetId={photo.assetId}
        size={size}
        style={styles.thumb}
      />
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
});

export function PhotoPreviewSheet({
  cluster,
  onClose,
  coverAssetId,
  onSetCover,
}: PhotoPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const thumbWarmScroll = usePauseGridThumbWarmOnScroll();
  const placeKey = cluster
    ? placeBucketKey(cluster.centerLat, cluster.centerLng)
    : null;
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const cell = (width - theme.spacing.md * 2 - theme.spacing.sm * 2) / 3;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cluster?.id]);

  const pagePhotos = useMemo(() => {
    if (!cluster) {
      return [];
    }
    return cluster.photos.slice(0, visibleCount);
  }, [cluster, visibleCount]);

  // Idle file thumbs — same path as playback/cards (not per-cell getAssetInfo).
  useEffect(() => {
    if (pagePhotos.length === 0) {
      return;
    }
    warmGridThumbs(
      pagePhotos.map((p) => p.assetId),
      PAGE_SIZE,
    );
  }, [pagePhotos]);

  useEffect(() => {
    if (!cluster) {
      setPlaceLabel(null);
      setLabelLoading(false);
      return;
    }
    let cancelled = false;
    const pin =
      (coverAssetId
        ? cluster.photos.find((p) => p.assetId === coverAssetId)
        : undefined) ?? cluster.photos[0];
    const lat = pin?.lat ?? cluster.centerLat;
    const lng = pin?.lng ?? cluster.centerLng;
    const cached = peekResolvedPlace(lat, lng);
    if (cached?.detailLabel) {
      setPlaceLabel(cached.detailLabel);
      setLabelLoading(false);
    } else {
      setPlaceLabel(null);
      setLabelLoading(true);
    }
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

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PhotoRef>) => (
      <PhotoThumb
        photo={item}
        size={cell}
        isCover={coverAssetId === item.assetId}
        onSelectCover={
          onSetCover && placeKey
            ? () => onSetCover(placeKey, item.assetId)
            : undefined
        }
      />
    ),
    [cell, coverAssetId, onSetCover, placeKey],
  );

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
            initialNumToRender={12}
            maxToRenderPerBatch={6}
            windowSize={6}
            updateCellsBatchingPeriod={40}
            removeClippedSubviews={Platform.OS === 'android'}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            renderItem={renderItem}
            extraData={coverAssetId}
            onScrollBeginDrag={thumbWarmScroll.onScrollBeginDrag}
            onMomentumScrollBegin={thumbWarmScroll.onMomentumScrollBegin}
            onScrollEndDrag={thumbWarmScroll.onScrollEndDrag}
            onMomentumScrollEnd={thumbWarmScroll.onMomentumScrollEnd}
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
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  close: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
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
