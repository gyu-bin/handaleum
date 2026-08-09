import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetThumbImage } from '@/features/photos/components/AssetThumbImage';
import { usePauseGridThumbWarmOnScroll } from '@/features/photos/hooks/usePauseGridThumbWarmOnScroll';
import {
  resolveAssetUri,
  syncAssetDisplayUri,
  warmGridThumbs,
} from '@/features/photos/services/mediaLibrary';
import type { PhotoRef } from '@/features/photos/types';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import {
  peekPhotosForStampLeaf,
  photosForStampLeaf,
  type StampDongPhotosQuery,
} from '../services/stampDongPhotos';

const COLS = 2;
const GAP = 10;
const H_PAD = theme.spacing.md;
/** Same tier as card/playback grids — warm 128px file://, not full ph://. */
const THUMB_IMAGE_SIZE = 128;
/** Full-bleed viewer — skip pin-thumb tier. */
const VIEWER_IMAGE_SIZE = 1080;
/** Fixed label slot — keeps every row the same height for getItemLayout. */
const LABEL_GAP = 5;
const LABEL_H = theme.type.micro.lineHeight;
const ROW_GAP_BOTTOM = GAP + 4;

type SortMode = 'newest' | 'oldest';

type ThumbItem = {
  assetId: string;
  dateLabel: string;
};

type ThumbRow = {
  key: string;
  items: ThumbItem[];
};

function formatTakenAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) {
    return '';
  }
  return new Date(t).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

function chunkRows(items: ThumbItem[]): ThumbRow[] {
  const rows: ThumbRow[] = [];
  for (let i = 0; i < items.length; i += COLS) {
    const slice = items.slice(i, i + COLS);
    rows.push({
      key: `row-${i}-${slice[0]?.assetId ?? i}`,
      items: slice,
    });
  }
  return rows;
}

function orderPhotos(photos: PhotoRef[], sortMode: SortMode): PhotoRef[] {
  if (photos.length <= 1) {
    return photos;
  }
  return [...photos].sort((a, b) =>
    sortMode === 'newest'
      ? b.takenAt.localeCompare(a.takenAt)
      : a.takenAt.localeCompare(b.takenAt),
  );
}

const Thumb = memo(function Thumb({
  assetId,
  dateLabel,
  size,
  onPress,
}: {
  assetId: string;
  dateLabel: string;
  size: number;
  onPress: (assetId: string) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(assetId);
  }, [assetId, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={strings.stamps.dongPhotosOpenPhoto}
      style={{ width: size }}
    >
      <View style={[styles.thumb, { width: size, height: size }]}>
        <AssetThumbImage
          assetId={assetId}
          size={size}
          imageSize={THUMB_IMAGE_SIZE}
        />
      </View>
      <Text style={styles.takenAt} numberOfLines={1}>
        {dateLabel}
      </Text>
    </Pressable>
  );
});

const ThumbRowView = memo(function ThumbRowView({
  row,
  cell,
  onPressPhoto,
}: {
  row: ThumbRow;
  cell: number;
  onPressPhoto: (assetId: string) => void;
}) {
  return (
    <View style={styles.row}>
      {row.items.map((item) => (
        <Thumb
          key={item.assetId}
          assetId={item.assetId}
          dateLabel={item.dateLabel}
          size={cell}
          onPress={onPressPhoto}
        />
      ))}
    </View>
  );
});

const ViewerPage = memo(function ViewerPage({
  item,
  width,
  height,
}: {
  item: ThumbItem;
  width: number;
  height: number;
}) {
  const syncUri = syncAssetDisplayUri(item.assetId, VIEWER_IMAGE_SIZE);
  const [asyncUri, setAsyncUri] = useState<string | null>(null);
  const uri = syncUri ?? asyncUri;

  useEffect(() => {
    if (syncUri) {
      return;
    }
    let cancelled = false;
    setAsyncUri(null);
    void resolveAssetUri(item.assetId, { imageSize: VIEWER_IMAGE_SIZE })
      .then((next) => {
        if (!cancelled) {
          setAsyncUri(next);
        }
      })
      .catch((error) => {
        console.warn('[stamps] viewer uri failed', item.assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [item.assetId, syncUri]);

  return (
    <View style={[styles.viewerPage, { width, height }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width, height: height - 48 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={`${item.assetId}-viewer`}
          priority="high"
          transition={0}
        />
      ) : (
        <View style={[styles.viewerPlaceholder, { width, height: height - 48 }]}>
          <ActivityIndicator color={theme.colors.ink} />
        </View>
      )}
      {item.dateLabel ? (
        <Text style={styles.viewerDate} numberOfLines={1}>
          {item.dateLabel}
        </Text>
      ) : null}
    </View>
  );
});

export interface StampDongPhotosModalProps {
  query: StampDongPhotosQuery | null;
  onClose: () => void;
}

/**
 * Full-screen quiet sheet: photos for a visited 동/읍·면.
 * Thumb path matches PhotoSelectGrid; tap opens in-modal pager.
 */
export function StampDongPhotosModal({
  query,
  onClose,
}: StampDongPhotosModalProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerEpoch, setViewerEpoch] = useState(0);
  const thumbWarmScroll = usePauseGridThumbWarmOnScroll();

  const visible = query != null;
  const leaf = query?.leaf ?? '';
  const viewerOpen = viewerIndex != null;

  useEffect(() => {
    if (!query) {
      setPhotos([]);
      setLoading(false);
      setViewerIndex(null);
      return;
    }
    let cancelled = false;
    setSortMode('newest');
    setViewerIndex(null);

    const peeked = peekPhotosForStampLeaf(query);
    if (peeked !== null) {
      setPhotos(peeked);
      setLoading(false);
      warmGridThumbs(
        peeked.map((p) => p.assetId),
        24,
      );
    } else {
      setPhotos([]);
      setLoading(true);
    }

    void photosForStampLeaf(query)
      .then((list) => {
        if (!cancelled) {
          setPhotos(list);
          warmGridThumbs(
            list.map((p) => p.assetId),
            24,
          );
        }
      })
      .catch((error) => {
        console.warn('[stamps] dong photos failed', error);
        if (!cancelled && peeked === null) {
          setPhotos([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    if (photos.length === 0) {
      return;
    }
    const handle = InteractionManager.runAfterInteractions(() => {
      warmGridThumbs(
        photos.map((p) => p.assetId),
        64,
      );
    });
    return () => handle.cancel();
  }, [photos]);

  const flatItems = useMemo((): ThumbItem[] => {
    if (photos.length === 0) {
      return [];
    }
    return orderPhotos(photos, sortMode).map((p) => ({
      assetId: p.assetId,
      dateLabel: formatTakenAt(p.takenAt),
    }));
  }, [photos, sortMode]);

  const rows = useMemo(() => chunkRows(flatItems), [flatItems]);

  const onCloseViewer = useCallback(() => {
    setViewerIndex(null);
  }, []);

  const onRequestClose = useCallback(() => {
    if (viewerIndex != null) {
      setViewerIndex(null);
      return;
    }
    onClose();
  }, [onClose, viewerIndex]);

  const onPressPhoto = useCallback(
    (assetId: string) => {
      const index = flatItems.findIndex((item) => item.assetId === assetId);
      if (index >= 0) {
        setViewerIndex(index);
        setViewerEpoch((n) => n + 1);
      }
    },
    [flatItems],
  );

  const onSortNewest = useCallback(() => {
    setViewerIndex(null);
    setSortMode('newest');
  }, []);

  const onSortOldest = useCallback(() => {
    setViewerIndex(null);
    setSortMode('oldest');
  }, []);

  const cell = Math.floor((windowW - H_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const rowHeight = cell + LABEL_GAP + LABEL_H + ROW_GAP_BOTTOM;
  const viewerH =
    windowH -
    Math.max(insets.top, theme.spacing.sm) -
    Math.max(insets.bottom, theme.spacing.sm) -
    56;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ThumbRow>) => (
      <ThumbRowView row={item} cell={cell} onPressPhoto={onPressPhoto} />
    ),
    [cell, onPressPhoto],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<ThumbRow> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: rowHeight * index,
      index,
    }),
    [rowHeight],
  );

  const renderViewerPage = useCallback(
    ({ item }: ListRenderItemInfo<ThumbItem>) => (
      <ViewerPage item={item} width={windowW} height={viewerH} />
    ),
    [viewerH, windowW],
  );

  const getViewerLayout = useCallback(
    (_: ArrayLike<ThumbItem> | null | undefined, index: number) => ({
      length: windowW,
      offset: windowW * index,
      index,
    }),
    [windowW],
  );

  const onViewerMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const next = Math.round(x / Math.max(1, windowW));
      if (next >= 0 && next < flatItems.length) {
        setViewerIndex(next);
      }
    },
    [flatItems.length, windowW],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onRequestClose}
    >
      <View
        style={[
          styles.root,
          {
            paddingTop: Math.max(insets.top, theme.spacing.sm),
            paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>
              {leaf}
            </Text>
            <Text style={styles.meta}>
              {loading && photos.length === 0
                ? strings.stamps.dongPhotosLoading
                : viewerOpen
                  ? strings.stamps.dongPhotosViewerHint
                  : strings.stamps.dongPhotosCount(photos.length)}
            </Text>
          </View>
          <Pressable
            onPress={viewerOpen ? onCloseViewer : onRequestClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              viewerOpen
                ? strings.stamps.dongPhotosViewerClose
                : strings.stamps.dongPhotosClose
            }
            style={({ pressed }) => [styles.closeHit, pressed && styles.pressed]}
          >
            <Text style={styles.closeLabel}>
              {viewerOpen
                ? strings.stamps.dongPhotosViewerClose
                : strings.stamps.dongPhotosClose}
            </Text>
          </Pressable>
        </View>

        {viewerOpen ? (
          <FlatList
            style={styles.viewerList}
            data={flatItems}
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
            windowSize={3}
            key={`viewer-${viewerEpoch}`}
          />
        ) : (
          <>
            {!loading && photos.length > 1 ? (
              <View style={styles.sortRow}>
                <Pressable
                  onPress={onSortNewest}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sortMode === 'newest' }}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text
                    style={[
                      styles.sortText,
                      sortMode === 'newest' && styles.sortTextOn,
                    ]}
                  >
                    {strings.stamps.dongPhotosNewest}
                  </Text>
                </Pressable>
                <Text style={styles.sortDot}>·</Text>
                <Pressable
                  onPress={onSortOldest}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sortMode === 'oldest' }}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Text
                    style={[
                      styles.sortText,
                      sortMode === 'oldest' && styles.sortTextOn,
                    ]}
                  >
                    {strings.stamps.dongPhotosOldest}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.sortSpacer} />
            )}

            <View style={styles.body}>
              {loading && photos.length === 0 ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.colors.ink} />
                </View>
              ) : photos.length === 0 ? (
                <View style={styles.center}>
                  <Text style={styles.empty}>
                    {strings.stamps.dongPhotosEmpty}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={rows}
                  keyExtractor={(item) => item.key}
                  contentContainerStyle={styles.grid}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={1}
                  windowSize={3}
                  updateCellsBatchingPeriod={100}
                  removeClippedSubviews={Platform.OS === 'android'}
                  getItemLayout={getItemLayout}
                  renderItem={renderItem}
                  onScrollBeginDrag={thumbWarmScroll.onScrollBeginDrag}
                  onScrollEndDrag={thumbWarmScroll.onScrollEndDrag}
                  onMomentumScrollEnd={thumbWarmScroll.onMomentumScrollEnd}
                />
              )}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: H_PAD,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  meta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
  },
  closeHit: {
    paddingVertical: 2,
    paddingLeft: theme.spacing.sm,
  },
  closeLabel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.45,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  sortSpacer: {
    height: theme.spacing.md,
  },
  sortText: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '500',
  },
  sortTextOn: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  sortDot: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  empty: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  grid: {
    paddingBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
    paddingBottom: ROW_GAP_BOTTOM,
  },
  thumb: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takenAt: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    marginTop: LABEL_GAP,
    height: LABEL_H,
    letterSpacing: 0.1,
  },
  viewerList: {
    flex: 1,
    marginHorizontal: -H_PAD,
  },
  viewerPage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  viewerDate: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
});
