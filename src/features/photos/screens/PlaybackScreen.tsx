import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingView } from '@/shared/components/LoadingView';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';

import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos } from '../services/cluster';
import { resolveAssetUri } from '../services/mediaLibrary';
import { startMonthImageWarmup } from '../services/monthImageWarmup';
import type { MonthKey, PhotoRef, PlaceCluster } from '../types';
import {
  placeBucketKey,
  resolveClusterDetailLabel,
} from '../utils/placeJourney';

const GRID_COLS = 3;
/** Cap thumbs on the active page — nested FlatList was killing swipe FPS. */
const GRID_MAX = 9;
const HERO_SIZE = 256;
const THUMB_SIZE = 128;

const GridThumb = memo(function GridThumb({
  photo,
  size,
  selected,
  isCover,
  onPress,
}: {
  photo: PhotoRef;
  size: number;
  selected: boolean;
  isCover: boolean;
  onPress: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolveAssetUri(photo.assetId, { imageSize: THUMB_SIZE })
      .then((next) => {
        if (!cancelled) {
          setUri(next);
        }
      })
      .catch((error) => {
        console.warn('GridThumb uri failed', photo.assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [photo.assetId]);

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
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.gridImage}
          contentFit="cover"
          recyclingKey={photo.assetId}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.gridImage, styles.placeholder]} />
      )}
      {isCover ? (
        <View style={styles.gridBadge}>
          <Text style={styles.gridBadgeText}>{strings.map.coverBadge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

/**
 * Heavy place page — mount grid / geocode / warmup only when settled on this page.
 * During horizontal paging every slide is a light shell.
 */
const ClusterSlide = memo(function ClusterSlide({
  cluster,
  width,
  coverAssetId,
  onSetCover,
  month,
  isActive,
}: {
  cluster: PlaceCluster;
  width: number;
  coverAssetId?: string | null;
  onSetCover: (placeKey: string, assetId: string) => void;
  month: MonthKey;
  /** Settled active page only — full UI. Others = shell. */
  isActive: boolean;
}) {
  const placeKey = placeBucketKey(cluster.centerLat, cluster.centerLng);
  const [activeId, setActiveId] = useState(
    () => coverAssetId ?? cluster.photos[0]?.assetId ?? '',
  );
  const [uri, setUri] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(true);

  const pad = theme.spacing.lg;
  const gap = theme.spacing.sm;
  const contentW = width - pad * 2;
  const cell = (contentW - gap * (GRID_COLS - 1)) / GRID_COLS;

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

  const activePhoto =
    cluster.photos.find((p) => p.assetId === activeId) ?? cluster.photos[0];

  const pagePhotos = useMemo(
    () => (isActive ? cluster.photos.slice(0, GRID_MAX) : []),
    [cluster.photos, isActive],
  );

  useEffect(() => {
    if (!isActive || pagePhotos.length === 0) {
      return;
    }
    startMonthImageWarmup({
      month,
      assetIds: pagePhotos.map((p) => p.assetId),
    });
  }, [isActive, month, pagePhotos]);

  useEffect(() => {
    if (!isActive || !activePhoto) {
      return;
    }
    let cancelled = false;
    void resolveAssetUri(activePhoto.assetId, { imageSize: HERO_SIZE })
      .then((next) => {
        if (!cancelled) {
          setUri(next);
        }
      })
      .catch((error) => {
        console.warn('ClusterSlide uri failed', activePhoto.assetId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [activePhoto, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    let cancelled = false;
    setLabelLoading(true);
    const pin = activePhoto ?? cluster.photos[0];
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
        console.warn('ClusterSlide label failed', error);
        if (!cancelled) {
          setPlaceLabel(null);
          setLabelLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activePhoto, cluster, isActive]);

  const onSelectPhoto = useCallback(
    (assetId: string) => {
      setActiveId(assetId);
      onSetCover(placeKey, assetId);
    },
    [onSetCover, placeKey],
  );

  const placeText = !isActive
    ? (placeLabel ?? strings.playback.placeLoading)
    : labelLoading
      ? strings.playback.placeLoading
      : (placeLabel ?? strings.playback.placeUnknown);

  const chapterDay = cluster.photos[0]?.takenAt
    ? strings.playback.chapterDay(cluster.photos[0].takenAt)
    : '';

  const titleBlock = (
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
  );

  if (!isActive) {
    return (
      <View style={[styles.slide, styles.gridContent, { width }]}>
        {titleBlock}
        <View
          style={[
            styles.imageWrap,
            styles.hero,
            styles.placeholder,
            { width: contentW },
          ]}
        />
      </View>
    );
  }

  // Vertical ScrollView — plain View overflow made down-swipes look like a blink
  // (parent pager stole the gesture / remounted the shell).
  return (
    <ScrollView
      style={[styles.slide, { width }]}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      {titleBlock}
      <View style={styles.imageWrap}>
        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.hero, { width: contentW }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={`${activeId}-${HERO_SIZE}`}
            priority="high"
          />
        ) : (
          <View style={[styles.hero, styles.placeholder, { width: contentW }]} />
        )}
      </View>
      {cluster.photos.length > 1 ? (
        <>
          <Text style={styles.gridHint}>{strings.playback.gridHint}</Text>
          <View style={[styles.gridRowWrap, { gap }]}>
            {pagePhotos.map((item) => (
              <GridThumb
                key={item.assetId}
                photo={item}
                size={cell}
                selected={item.assetId === activeId}
                isCover={item.assetId === (coverAssetId ?? activeId)}
                onPress={() => onSelectPhoto(item.assetId)}
              />
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
});

/**
 * Place-chapter view: horizontal pages per place (no autoplay).
 * Order = month day 1 → end (cluster by first photo, photos already time-sorted).
 */
export function PlaybackScreen() {
  const { width } = useWindowDimensions();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const showLoading = useHeldBusy(isPending);
  const { covers, setCover } = usePinCovers(month);
  const [index, setIndex] = useState(0);
  /** While paging, every slide stays a shell — nested grids kill swipe FPS. */
  const [isPaging, setIsPaging] = useState(false);
  const listRef = useRef<FlatList<PlaceCluster>>(null);
  const settledXRef = useRef(0);

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
    setIsPaging(false);
    settledXRef.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [month]);

  useEffect(() => {
    settledXRef.current = index * width;
  }, [index, width]);

  const renderPlace = useCallback(
    ({ item, index: itemIndex }: ListRenderItemInfo<PlaceCluster>) => {
      const key = placeBucketKey(item.centerLat, item.centerLng);
      return (
        <ClusterSlide
          cluster={item}
          width={width}
          coverAssetId={covers[key] ?? null}
          onSetCover={setCover}
          month={month}
          isActive={!isPaging && itemIndex === index}
        />
      );
    },
    [covers, index, isPaging, month, setCover, width],
  );

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(next, clusters.length - 1)));
      setIsPaging(false);
    },
    [clusters.length, width],
  );

  /** Shell only after a real horizontal page move — not on vertical pan. */
  const onHorizScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      if (Math.abs(x - settledXRef.current) > width * 0.1) {
        setIsPaging(true);
      }
    },
    [width],
  );

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= clusters.length) {
        return;
      }
      setIsPaging(true);
      try {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      } catch (error) {
        console.warn('playback goTo failed', next, error);
        listRef.current?.scrollToOffset({
          offset: next * width,
          animated: true,
        });
      }
    },
    [clusters.length, width],
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

  const canPrev = index > 0;
  const canNext = index < clusters.length - 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.playback.title} />
      <FlatList
        ref={listRef}
        style={styles.list}
        data={clusters}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onHorizScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        extraData={`${index}:${isPaging ? 1 : 0}`}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={2}
        removeClippedSubviews
        updateCellsBatchingPeriod={50}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        onScrollToIndexFailed={({ index: failedIndex }) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: Math.max(0, failedIndex) * width,
              animated: false,
            });
            setIndex(Math.max(0, Math.min(failedIndex, clusters.length - 1)));
            setIsPaging(false);
          });
        }}
        renderItem={renderPlace}
      />
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
  slide: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  headerBlock: {
    marginBottom: theme.spacing.xs,
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
    aspectRatio: 4 / 5,
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
  gridRow: {
    marginBottom: theme.spacing.sm,
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
