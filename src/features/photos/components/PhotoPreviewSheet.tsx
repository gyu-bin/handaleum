import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { AssetThumbImage } from './AssetThumbImage';
import { usePauseGridThumbWarmOnScroll } from '../hooks/usePauseGridThumbWarmOnScroll';
import {
  resolveAssetUri,
  syncAssetDisplayUri,
  warmGridThumbs,
} from '../services/mediaLibrary';
import type { PlaceCluster, PhotoRef } from '../types';
import { placeBucketKey, resolveClusterDetailLabel } from '../utils/placeJourney';
import { peekResolvedPlace } from '../services/placeResolve';

/** Photos appended per scroll page in the pin sheet grid. */
const PAGE_SIZE = 18;
const COMPACT_HERO = 72;
const COMPACT_STRIP = 36;
const COMPACT_STRIP_MAX = 8;
/** Full-bleed viewer — skip pin-thumb tier. */
const VIEWER_IMAGE_SIZE = 1080;

export interface PhotoPreviewSheetProps {
  /** null closes the sheet */
  cluster: PlaceCluster | null;
  onClose: () => void;
  /** Currently selected cover asset for this place bucket. */
  coverAssetId?: string | null;
  /** Set cover for the cluster's place bucket. Map home only. */
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
  onOpenViewer,
}: {
  photo: PhotoRef;
  size: number;
  isCover: boolean;
  onSelectCover?: () => void;
  onOpenViewer?: () => void;
}) {
  const canSetCover = onSelectCover != null;
  const canView = onOpenViewer != null;
  return (
    <Pressable
      onPress={canSetCover ? onSelectCover : onOpenViewer}
      disabled={!canSetCover && !canView}
      accessibilityRole="button"
      accessibilityLabel={
        canSetCover
          ? isCover
            ? strings.map.coverSelected
            : strings.map.setAsCover
          : strings.playback.openPhoto
      }
      style={{ width: size, height: size, margin: theme.spacing.sm / 2 }}
    >
      <AssetThumbImage
        assetId={photo.assetId}
        size={size}
        style={styles.thumb}
      />
      {canSetCover && isCover ? (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>{strings.map.coverBadge}</Text>
        </View>
      ) : canSetCover ? (
        <View style={styles.coverHint}>
          <Text style={styles.coverHintText}>{strings.map.setAsCoverShort}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const ViewerPage = memo(function ViewerPage({
  photo,
  width,
  height,
}: {
  photo: PhotoRef;
  width: number;
  height: number;
}) {
  // Dummy → bundled URI; real iOS → ph:// (1080 skips soft pin-thumb bake).
  const syncUri = syncAssetDisplayUri(photo.assetId, VIEWER_IMAGE_SIZE);
  const [asyncUri, setAsyncUri] = useState<string | null>(null);
  const uri = syncUri ?? asyncUri;
  const imageH = height - 48;
  const dateLabel = formatTakenAt(photo.takenAt);

  useEffect(() => {
    if (syncUri) {
      return;
    }
    let cancelled = false;
    setAsyncUri(null);
    void resolveAssetUri(photo.assetId, { imageSize: VIEWER_IMAGE_SIZE })
      .then((next) => {
        if (!cancelled) {
          setAsyncUri(next);
        }
      })
      .catch((error) => {
        console.warn('[photos] viewer uri failed', photo.assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.assetId, syncUri]);

  return (
    <View style={[styles.viewerPage, { width, height }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width, height: imageH }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`${photo.assetId}-viewer`}
          priority="high"
          transition={0}
          allowDownscaling
        />
      ) : (
        <View style={[styles.viewerPlaceholder, { width, height: imageH }]}>
          <ActivityIndicator color={theme.colors.ink} />
        </View>
      )}
      {dateLabel ? (
        <Text style={styles.viewerDate} numberOfLines={1}>
          {dateLabel}
        </Text>
      ) : null}
    </View>
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
  const { width, height: windowH } = useWindowDimensions();
  const thumbWarmScroll = usePauseGridThumbWarmOnScroll();
  const placeKey = cluster
    ? placeBucketKey(cluster.centerLat, cluster.centerLng)
    : null;
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState(variant === 'sheet');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const cell = (width - theme.spacing.md * 2 - theme.spacing.sm * 2) / 3;
  const viewerOpen = viewerIndex != null;
  const canSetCover = onSetCover != null;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setExpanded(variant === 'sheet');
    setViewerIndex(null);
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

  const allPhotos = cluster?.photos ?? [];

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

  const closeSheet = useCallback(() => {
    setViewerIndex(null);
    if (variant === 'compact') {
      setExpanded(false);
      onClose();
      return;
    }
    onClose();
  }, [onClose, variant]);

  const onCloseViewer = useCallback(() => {
    setViewerIndex(null);
  }, []);

  const onViewerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(width, 1));
      if (next >= 0 && next < allPhotos.length) {
        setViewerIndex(next);
      }
    },
    [allPhotos.length, width],
  );

  const getViewerLayout = useCallback(
    (_: ArrayLike<PhotoRef> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const viewerH = Math.max(
    280,
    windowH - insets.top - insets.bottom - 72,
  );

  const renderViewerPage = useCallback(
    ({ item }: ListRenderItemInfo<PhotoRef>) => (
      <ViewerPage photo={item} width={width} height={viewerH} />
    ),
    [viewerH, width],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PhotoRef>) => (
      <PhotoThumb
        photo={item}
        size={cell}
        isCover={coverAssetId === item.assetId}
        onSelectCover={
          canSetCover && placeKey
            ? () => onSetCover?.(placeKey, item.assetId)
            : undefined
        }
        onOpenViewer={
          canSetCover
            ? undefined
            : () => {
                const fullIndex = allPhotos.findIndex(
                  (p) => p.assetId === item.assetId,
                );
                setViewerIndex(fullIndex >= 0 ? fullIndex : index);
              }
        }
      />
    ),
    [allPhotos, canSetCover, cell, coverAssetId, onSetCover, placeKey],
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
          if (viewerOpen) {
            onCloseViewer();
            return;
          }
          closeSheet();
        }}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (viewerOpen) {
                onCloseViewer();
                return;
              }
              closeSheet();
            }}
            accessibilityRole="button"
            accessibilityLabel={strings.common.cancel}
          />
          <View
            style={[
              styles.sheet,
              viewerOpen && styles.sheetViewer,
              {
                paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
              },
            ]}
          >
            <View
              style={[styles.handle, viewerOpen && styles.handleOnDark]}
            />
            <View style={styles.header}>
              <View style={styles.titleBlock}>
                <Text
                  style={[styles.title, viewerOpen && styles.titleOnDark]}
                  numberOfLines={1}
                >
                  {viewerOpen ? strings.playback.openPhoto : titleText}
                </Text>
                {viewerOpen ? (
                  <Text style={[styles.meta, styles.metaOnDark]} numberOfLines={1}>
                    {strings.playback.viewerHint}
                  </Text>
                ) : (
                  <>
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
                    {canSetCover ? (
                      <Text style={styles.meta}>{strings.map.coverHint}</Text>
                    ) : (
                      <Text style={styles.meta}>{strings.playback.gridHint}</Text>
                    )}
                  </>
                )}
              </View>
              <Pressable
                onPress={viewerOpen ? onCloseViewer : closeSheet}
                accessibilityRole="button"
              >
                <Text style={[styles.close, viewerOpen && styles.closeOnDark]}>
                  {viewerOpen
                    ? strings.common.cancel
                    : strings.common.confirm}
                </Text>
              </Pressable>
            </View>
            {viewerOpen && cluster ? (
              <FlatList
                key="photo-viewer"
                style={styles.viewerList}
                data={allPhotos}
                keyExtractor={(item) => item.assetId}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={viewerIndex ?? 0}
                getItemLayout={getViewerLayout}
                renderItem={renderViewerPage}
                onMomentumScrollEnd={onViewerMomentumEnd}
                initialNumToRender={1}
                maxToRenderPerBatch={1}
                windowSize={2}
                removeClippedSubviews={Platform.OS === 'android'}
              />
            ) : cluster ? (
              <FlatList
                key="photo-grid"
                style={styles.grid}
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
    height: '80%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  sheetViewer: {
    height: '92%',
    maxHeight: '92%',
    backgroundColor: theme.colors.viewerBackdrop,
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
  handleOnDark: {
    backgroundColor: theme.colors.viewerMuted,
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
  titleOnDark: {
    color: theme.colors.background,
  },
  meta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  metaOnDark: {
    color: theme.colors.viewerMuted,
  },
  close: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.terracotta,
    fontWeight: '600',
    marginTop: 2,
  },
  closeOnDark: {
    color: theme.colors.background,
  },

  list: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md - theme.spacing.sm / 2,
    paddingBottom: theme.spacing.xl,
  },
  grid: {
    flex: 1,
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
  viewerList: {
    flex: 1,
  },
  viewerPage: {
    justifyContent: 'center',
  },
  viewerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerDate: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.viewerMuted,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
});
