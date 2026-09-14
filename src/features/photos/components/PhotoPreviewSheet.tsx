import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
const COMPACT_HERO = 72;
const COMPACT_STRIP = 36;
const COMPACT_STRIP_MAX = 8;

export interface PhotoPreviewSheetProps {
  /** null closes the sheet */
  cluster: PlaceCluster | null;
  onClose: () => void;
  /** Currently selected cover asset for this place bucket. */
  coverAssetId?: string | null;
  /** Set cover for the cluster's place bucket. */
  onSetCover?: (placeKey: string, assetId: string) => void;
  /**
   * `compact` — floating card above bottom nav (map home).
   * Tap expands to the existing detail sheet.
   * `sheet` — full place sheet (몰아보기).
   */
  variant?: 'compact' | 'sheet';
  /** Extra bottom inset so compact card clears HomeNavBar. */
  bottomOffset?: number;
}

function formatTakenAt(iso: string | undefined): string | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
  variant = 'sheet',
  bottomOffset = 0,
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
  const [expanded, setExpanded] = useState(variant === 'sheet');
  const cell = (width - theme.spacing.md * 2 - theme.spacing.sm * 2) / 3;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setExpanded(variant === 'sheet');
  }, [cluster?.id, variant]);

  const heroPhoto = useMemo(() => {
    if (!cluster) {
      return null;
    }
    if (coverAssetId) {
      const hit = cluster.photos.find((p) => p.assetId === coverAssetId);
      if (hit) {
        return hit;
      }
    }
    return cluster.photos[0] ?? null;
  }, [cluster, coverAssetId]);

  const pagePhotos = useMemo(() => {
    if (!cluster) {
      return [];
    }
    return cluster.photos.slice(0, visibleCount);
  }, [cluster, visibleCount]);

  const stripPhotos = useMemo(() => {
    if (!cluster) {
      return [];
    }
    return cluster.photos.slice(0, COMPACT_STRIP_MAX);
  }, [cluster]);

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
    if (!cluster || !heroPhoto) {
      return;
    }
    if (variant === 'compact' && !expanded) {
      warmGridThumbs(
        stripPhotos.map((p) => p.assetId),
        COMPACT_STRIP_MAX,
      );
    }
  }, [cluster, expanded, heroPhoto, stripPhotos, variant]);

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
  const takenLabel = formatTakenAt(heroPhoto?.takenAt);

  const showCompact = variant === 'compact' && cluster != null && !expanded;
  const showSheet =
    cluster != null && (variant === 'sheet' || expanded);

  return (
    <>
      {showCompact && heroPhoto ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.compactWrap,
            { bottom: bottomOffset + theme.spacing.sm },
          ]}
        >
          <Pressable
            onPress={() => setExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel={titleText}
            style={({ pressed }) => [
              styles.compactCard,
              pressed && styles.compactCardPressed,
            ]}
          >
            <AssetThumbImage
              assetId={heroPhoto.assetId}
              size={COMPACT_HERO}
              style={styles.compactHero}
            />
            <View style={styles.compactBody}>
              <View style={styles.compactTitleRow}>
                <Text style={styles.compactTitle} numberOfLines={1}>
                  {titleText}
                </Text>
                <Text style={styles.compactChevron}>›</Text>
              </View>
              {takenLabel ? (
                <Text style={styles.compactMeta} numberOfLines={1}>
                  {takenLabel}
                </Text>
              ) : cluster.photos.length > 1 ? (
                <Text style={styles.compactMeta} numberOfLines={1}>
                  {strings.map.clusterCount(cluster.photos.length)}
                </Text>
              ) : null}
              {stripPhotos.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.compactStrip}
                >
                  {stripPhotos.map((p) => (
                    <AssetThumbImage
                      key={p.assetId}
                      assetId={p.assetId}
                      size={COMPACT_STRIP}
                      style={styles.compactStripThumb}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={showSheet}
        animationType="slide"
        transparent
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          if (variant === 'compact') {
            setExpanded(false);
            onClose();
            return;
          }
          onClose();
        }}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (variant === 'compact') {
                setExpanded(false);
                onClose();
                return;
              }
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel={strings.common.cancel}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
            ]}
          >
            <View style={styles.handle} />
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
                {takenLabel ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {takenLabel}
                  </Text>
                ) : null}
                {onSetCover ? (
                  <Text style={styles.meta}>{strings.map.coverHint}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => {
                  if (variant === 'compact') {
                    setExpanded(false);
                    onClose();
                    return;
                  }
                  onClose();
                }}
                accessibilityRole="button"
              >
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
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 20,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  compactCardPressed: {
    opacity: 0.92,
  },
  compactHero: {
    width: COMPACT_HERO,
    height: COMPACT_HERO,
    borderRadius: 10,
  },
  compactBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  compactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactTitle: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    color: theme.colors.ink,
    letterSpacing: -0.2,
  },
  compactChevron: {
    fontFamily: theme.fonts.sans,
    fontSize: 18,
    lineHeight: 20,
    color: theme.colors.subtle,
    fontWeight: '400',
  },
  compactMeta: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.inkSoft,
  },
  compactStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 4,
  },
  compactStripThumb: {
    width: COMPACT_STRIP,
    height: COMPACT_STRIP,
    borderRadius: 6,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(44,62,80,0.18)',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    maxHeight: '62%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 34,
    height: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.tint.mid,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
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
    flexGrow: 0,
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
