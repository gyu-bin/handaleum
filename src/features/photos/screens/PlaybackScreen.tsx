import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  InteractionManager,
  Platform,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';

import { AssetThumbImage } from '../components/AssetThumbImage';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePauseGridThumbWarmOnScroll } from '../hooks/usePauseGridThumbWarmOnScroll';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos } from '../services/cluster';
import {
  resolveAssetUri,
  syncAssetDisplayUri,
  warmGridThumbs,
} from '../services/mediaLibrary';
import type { PhotoRef, PlaceCluster } from '../types';
import {
  placeBucketKey,
  resolveClusterDetailLabel,
} from '../utils/placeJourney';

const GRID_COLS = 3;
/** Ask past pin-thumb size so syncAssetDisplayUri returns full ph:// / localUri. */
const HERO_SIZE = 1080;
const ROW_GAP = theme.spacing.sm;
/** Scroll distance (px) to shrink hero from 1:1 → 16:9. */
const HERO_COLLAPSE_RANGE = 160;

type ThumbRow = { key: string; photos: PhotoRef[] };

function chunkThumbs(photos: PhotoRef[]): ThumbRow[] {
  const rows: ThumbRow[] = [];
  for (let i = 0; i < photos.length; i += GRID_COLS) {
    const slice = photos.slice(i, i + GRID_COLS);
    rows.push({
      key: `r-${slice[0]?.assetId ?? i}`,
      photos: slice,
    });
  }
  return rows;
}

const GridThumb = memo(function GridThumb({
  assetId,
  size,
  selected,
  isCover,
  onSelectPhoto,
}: {
  assetId: string;
  size: number;
  selected: boolean;
  isCover: boolean;
  onSelectPhoto: (assetId: string) => void;
}) {
  const onPress = useCallback(() => {
    onSelectPhoto(assetId);
  }, [assetId, onSelectPhoto]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isCover ? strings.map.coverSelected : strings.map.setAsCover
      }
      style={[
        styles.gridThumb,
        { width: size, height: size },
        selected && styles.gridThumbSelected,
        isCover && styles.gridThumbCover,
      ]}
    >
      <AssetThumbImage assetId={assetId} size={size} style={styles.gridImage} />
      {isCover ? (
        <View style={styles.gridBadge}>
          <Text style={styles.gridBadgeText}>{strings.map.coverBadge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const ThumbRowView = memo(function ThumbRowView({
  row,
  cell,
  activeId,
  coverId,
  onSelectPhoto,
}: {
  row: ThumbRow;
  cell: number;
  activeId: string;
  coverId: string;
  onSelectPhoto: (assetId: string) => void;
}) {
  return (
    <View style={[styles.gridRowWrap, { gap: ROW_GAP, marginBottom: ROW_GAP }]}>
      {row.photos.map((photo) => (
        <GridThumb
          key={photo.assetId}
          assetId={photo.assetId}
          size={cell}
          selected={photo.assetId === activeId}
          isCover={photo.assetId === coverId}
          onSelectPhoto={onSelectPhoto}
        />
      ))}
    </View>
  );
});

/**
 * One place chapter — vertical FlatList of every photo (not nested in a pager).
 */
const ClusterSlide = memo(function ClusterSlide({
  cluster,
  width,
  coverAssetId,
  onSetCover,
}: {
  cluster: PlaceCluster;
  width: number;
  coverAssetId?: string | null;
  onSetCover: (placeKey: string, assetId: string) => void;
}) {
  const placeKey = placeBucketKey(cluster.centerLat, cluster.centerLng);
  const [activeId, setActiveId] = useState(
    () => coverAssetId ?? cluster.photos[0]?.assetId ?? '',
  );
  const [asyncHeroUri, setAsyncHeroUri] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(true);
  const scrollingRef = useRef(false);
  const pendingLabelRef = useRef<{
    label: string | null;
    loading: boolean;
  } | null>(null);
  const thumbWarmScroll = usePauseGridThumbWarmOnScroll();
  const scrollY = useSharedValue(0);

  const pad = theme.spacing.lg;
  const contentW = width - pad * 2;
  const heroFullH = contentW;
  const heroMinH = contentW * (9 / 16);
  const cell = (contentW - ROW_GAP * (GRID_COLS - 1)) / GRID_COLS;
  const rowHeight = cell + ROW_GAP;

  const onThumbScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_RANGE],
      [heroFullH, heroMinH],
      Extrapolation.CLAMP,
    ),
    width: contentW,
  }));

  const hintAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HERO_COLLAPSE_RANGE * 0.45],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  useEffect(() => {
    const next =
      (coverAssetId &&
      cluster.photos.some((p) => p.assetId === coverAssetId)
        ? coverAssetId
        : null) ??
      cluster.photos[0]?.assetId ??
      '';
    setActiveId(next);
  }, [cluster, coverAssetId]);

  // Pre-bake small file thumbs after mount — recycle uses file://, not ph://.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      warmGridThumbs(
        cluster.photos.map((p) => p.assetId),
        64,
      );
    });
    return () => handle.cancel();
  }, [cluster]);

  const activePhoto =
    cluster.photos.find((p) => p.assetId === activeId) ?? cluster.photos[0];

  const thumbRows = useMemo(
    () => chunkThumbs(cluster.photos),
    [cluster.photos],
  );

  const syncHeroUri = activePhoto
    ? syncAssetDisplayUri(activePhoto.assetId, HERO_SIZE)
    : null;
  const uri = syncHeroUri ?? asyncHeroUri;

  useEffect(() => {
    if (!activePhoto || syncHeroUri) {
      return;
    }
    let cancelled = false;
    setAsyncHeroUri(null);
    void resolveAssetUri(activePhoto.assetId, { imageSize: HERO_SIZE })
      .then((next) => {
        if (!cancelled) {
          setAsyncHeroUri(next);
        }
      })
      .catch((error) => {
        console.warn('ClusterSlide uri failed', activePhoto.assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [activePhoto, syncHeroUri]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const pin = activePhoto ?? cluster.photos[0];
      const lat = pin?.lat ?? cluster.centerLat;
      const lng = pin?.lng ?? cluster.centerLng;
      const apply = (label: string | null, loading: boolean) => {
        if (scrollingRef.current) {
          pendingLabelRef.current = { label, loading };
          return;
        }
        setPlaceLabel(label);
        setLabelLoading(loading);
      };
      if (!scrollingRef.current) {
        setLabelLoading(true);
      }
      void resolveClusterDetailLabel(lat, lng)
        .then((label) => {
          if (!cancelled) {
            apply(label, false);
          }
        })
        .catch((error) => {
          console.warn('ClusterSlide label failed', error);
          if (!cancelled) {
            apply(null, false);
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activePhoto, cluster.centerLat, cluster.centerLng, cluster.photos]);

  const flushPendingLabel = useCallback(() => {
    const pending = pendingLabelRef.current;
    if (!pending) {
      return;
    }
    pendingLabelRef.current = null;
    setPlaceLabel(pending.label);
    setLabelLoading(pending.loading);
  }, []);

  const onSelectPhoto = useCallback(
    (assetId: string) => {
      setActiveId(assetId);
      onSetCover(placeKey, assetId);
    },
    [onSetCover, placeKey],
  );

  const placeText = labelLoading
    ? strings.playback.placeLoading
    : (placeLabel ?? strings.playback.placeUnknown);

  const chapterDay = cluster.photos[0]?.takenAt
    ? strings.playback.chapterDay(cluster.photos[0].takenAt)
    : '';

  const coverId = coverAssetId ?? activeId;

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<ThumbRow>) => (
      <ThumbRowView
        row={item}
        cell={cell}
        activeId={activeId}
        coverId={coverId}
        onSelectPhoto={onSelectPhoto}
      />
    ),
    [activeId, cell, coverId, onSelectPhoto],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<ThumbRow> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: rowHeight * index,
      index,
    }),
    [rowHeight],
  );

  return (
    <View style={styles.list}>
      {/* Hero outside FlatList — label/uri updates must not relayout the grid. */}
      <View style={styles.chapterHead}>
        <View style={styles.titleRow}>
          <Text style={styles.place} numberOfLines={2}>
            {placeText}
          </Text>
          <View style={styles.metaCol}>
            {chapterDay ? (
              <Text style={styles.meta} numberOfLines={1}>
                {chapterDay}
              </Text>
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              {strings.map.clusterCount(cluster.photos.length)}
            </Text>
          </View>
        </View>
        <Animated.View style={[styles.imageWrap, heroAnimStyle]}>
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.hero}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={`${activeId}-${HERO_SIZE}`}
              priority="high"
              transition={0}
              allowDownscaling
            />
          ) : (
            <View style={[styles.hero, styles.placeholder]} />
          )}
        </Animated.View>
        {cluster.photos.length > 1 ? (
          <Animated.Text style={[styles.gridHint, hintAnimStyle]}>
            {strings.playback.gridHint}
          </Animated.Text>
        ) : null}
      </View>

      <Animated.FlatList
        style={styles.thumbList}
        data={thumbRows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={1}
        windowSize={3}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={getItemLayout}
        renderItem={renderRow}
        extraData={`${activeId}:${coverId}`}
        onScroll={onThumbScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          scrollingRef.current = true;
          thumbWarmScroll.onScrollBeginDrag();
        }}
        onScrollEndDrag={() => {
          thumbWarmScroll.onScrollEndDrag();
          setTimeout(() => {
            scrollingRef.current = false;
            flushPendingLabel();
          }, 80);
        }}
        onMomentumScrollEnd={() => {
          scrollingRef.current = false;
          thumbWarmScroll.onMomentumScrollEnd();
          flushPendingLabel();
        }}
      />
    </View>
  );
});

/**
 * Place-chapter view: one place at a time; ‹ › changes place.
 * Vertical list is never nested in a horizontal pager.
 */
export function PlaybackScreen() {
  const { width } = useWindowDimensions();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const showLoading = useHeldBusy(isPending);
  const { covers, setCover } = usePinCovers(month);
  const [index, setIndex] = useState(0);

  const clusters = useMemo(() => {
    if (!data) {
      return [];
    }
    return clusterPhotos(data.photos, 14).sort((a, b) => {
      const a0 = a.photos[0]?.takenAt ?? '';
      const b0 = b.photos[0]?.takenAt ?? '';
      return a0.localeCompare(b0);
    });
  }, [data]);

  useEffect(() => {
    setIndex(0);
  }, [month]);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= clusters.length) {
        return;
      }
      setIndex(next);
    },
    [clusters.length],
  );

  if (showLoading) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.playback.title} />
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  if (clusters.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScreenHeader title={strings.playback.title} />
        <StateView icon="🎞️" title={strings.playback.empty} />
      </SafeAreaView>
    );
  }

  const cluster = clusters[index]!;
  const placeKey = placeBucketKey(cluster.centerLat, cluster.centerLng);
  const canPrev = index > 0;
  const canNext = index < clusters.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.playback.title} />
      <View style={styles.list}>
        <ClusterSlide
          key={cluster.id}
          cluster={cluster}
          width={width}
          coverAssetId={covers[placeKey] ?? null}
          onSetCover={setCover}
        />
      </View>
      {clusters.length > 1 ? (
        <View style={styles.pager}>
          <Pressable
            onPress={() => goTo(index - 1)}
            disabled={!canPrev}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.playback.prevPlace}
            style={({ pressed }) => [
              styles.arrowBtn,
              !canPrev && styles.arrowBtnDisabled,
              pressed && canPrev && styles.arrowBtnPressed,
            ]}
          >
            <Text style={styles.arrowGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.pagerCount}>
            {index + 1} / {clusters.length}
          </Text>
          <Pressable
            onPress={() => goTo(index + 1)}
            disabled={!canNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={strings.playback.nextPlace}
            style={({ pressed }) => [
              styles.arrowBtn,
              !canNext && styles.arrowBtnDisabled,
              pressed && canNext && styles.arrowBtnPressed,
            ]}
          >
            <Text style={styles.arrowGlyph}>›</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  list: {
    flex: 1,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  arrowBtnPressed: {
    backgroundColor: theme.tint.faint,
  },
  arrowBtnDisabled: {
    opacity: 0.28,
  },
  arrowGlyph: {
    fontSize: 28,
    lineHeight: 30,
    color: theme.colors.ink,
    fontWeight: '300',
    marginTop: -2,
  },
  pagerCount: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'center',
  },
  chapterHead: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  thumbList: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  place: {
    ...theme.type.title,
    flex: 1,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  metaCol: {
    alignItems: 'flex-end',
    paddingTop: 4,
    maxWidth: '42%',
  },
  meta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
    textAlign: 'right',
  },
  imageWrap: {
    marginTop: theme.spacing.md,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceAlt,
  },
  placeholder: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  gridHint: {
    ...theme.type.micro,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    color: theme.colors.subtle,
  },
  gridRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  gridThumb: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.line,
  },
  gridThumbSelected: {
    borderColor: theme.colors.ink,
  },
  gridThumbCover: {
    borderColor: theme.colors.ink,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.tint.full,
  },
  gridBadgeText: {
    ...theme.type.micro,
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: 9,
  },
});
