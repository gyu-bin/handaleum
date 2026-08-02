import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
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

import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos } from '../services/cluster';
import { resolveAssetUri } from '../services/mediaLibrary';
import type { PhotoRef, PlaceCluster } from '../types';
import {
  placeBucketKey,
  resolveClusterDetailLabel,
} from '../utils/placeJourney';

const GRID_COLS = 3;
/** Photos appended per scroll page in the place grid. */
const PAGE_SIZE = 50;

function GridThumb({
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
    void resolveAssetUri(photo.assetId)
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
}

function ClusterSlide({
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
  const [uri, setUri] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const pad = theme.spacing.lg;
  const gap = theme.spacing.sm;
  const contentW = width - pad * 2;
  const cell = (contentW - gap * (GRID_COLS - 1)) / GRID_COLS;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [cluster.id]);

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

  useEffect(() => {
    if (!activePhoto) {
      return;
    }
    let cancelled = false;
    void resolveAssetUri(activePhoto.assetId)
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
  }, [activePhoto]);

  useEffect(() => {
    let cancelled = false;
    setPlaceLabel(null);
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
  }, [activePhoto, cluster]);

  const onSelectPhoto = (assetId: string) => {
    setActiveId(assetId);
    onSetCover(placeKey, assetId);
  };

  const placeText = labelLoading
    ? strings.playback.placeLoading
    : (placeLabel ?? strings.playback.placeUnknown);

  const pagePhotos = useMemo(
    () => cluster.photos.slice(0, visibleCount),
    [cluster.photos, visibleCount],
  );

  const loadMore = useCallback(() => {
    setVisibleCount((n) =>
      n >= cluster.photos.length
        ? n
        : Math.min(n + PAGE_SIZE, cluster.photos.length),
    );
  }, [cluster.photos.length]);

  const header = (
    <View
      style={[
        styles.headerBlock,
        cluster.photos.length <= 1 && styles.gridContent,
      ]}
    >
      <View style={styles.imageWrap}>
        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.hero, { width: contentW }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={activeId}
          />
        ) : (
          <View style={[styles.hero, styles.placeholder, { width: contentW }]} />
        )}
      </View>
      <Text style={styles.place} numberOfLines={2}>
        {placeText}
      </Text>
      <Text style={styles.meta}>
        {strings.map.clusterCount(cluster.photos.length)}
      </Text>
      <Text style={styles.date}>
        {new Date(activePhoto?.takenAt ?? '').toLocaleString('ko-KR')}
      </Text>
      {cluster.photos.length > 1 ? (
        <Text style={styles.gridHint}>{strings.playback.gridHint}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.slide, { width }]}>
      {cluster.photos.length <= 1 ? (
        header
      ) : (
        <FlatList
          data={pagePhotos}
          keyExtractor={(item) => item.assetId}
          numColumns={GRID_COLS}
          ListHeaderComponent={header}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={[styles.gridRow, { gap }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          initialNumToRender={PAGE_SIZE}
          maxToRenderPerBatch={12}
          windowSize={7}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <GridThumb
              photo={item}
              size={cell}
              selected={item.assetId === activeId}
              isCover={item.assetId === (coverAssetId ?? activeId)}
              onPress={() => onSelectPhoto(item.assetId)}
            />
          )}
        />
      )}
    </View>
  );
}

/** Dwell time per place when auto-playing, in ms. */
const AUTOPLAY_MS = 2800;

/**
 * Storytelling view: horizontal pages per place. Each page shows a large
 * cover photo and a 3-column grid of photos at that place.
 */
export function PlaybackScreen() {
  const { width } = useWindowDimensions();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const { covers, setCover } = usePinCovers(month);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<FlatList<PlaceCluster>>(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  const clusters = useMemo(() => {
    if (!data) {
      return [];
    }
    return clusterPhotos(data.photos, 14).sort(
      (a, b) =>
        Date.parse(a.photos[0]!.takenAt) - Date.parse(b.photos[0]!.takenAt),
    );
  }, [data]);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [month]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= clusters.length) {
        setPlaying(false);
        return;
      }
      try {
        listRef.current?.scrollToIndex({ index: next, animated: true });
        setIndex(next);
      } catch (error) {
        console.warn('playback scrollToIndex failed', next, error);
        setPlaying(false);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [playing, clusters.length]);

  const togglePlay = () => {
    setPlaying((prev) => {
      if (!prev && index >= clusters.length - 1) {
        try {
          listRef.current?.scrollToIndex({ index: 0, animated: false });
        } catch (error) {
          console.warn('playback restart scrollToIndex failed', error);
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }
        setIndex(0);
      }
      return !prev;
    });
  };

  if (isPending) {
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

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.playback.title}
        trailing={
          <View style={styles.trailing}>
            <Pressable
              onPress={togglePlay}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                playing ? strings.playback.pause : strings.playback.play
              }
              style={({ pressed }) => [
                styles.playBtn,
                pressed && styles.playBtnPressed,
              ]}
            >
              <Text style={styles.playIcon}>{playing ? '❚❚' : '▶'}</Text>
            </Pressable>
            <Text style={styles.counter}>
              {index + 1}/{clusters.length}
            </Text>
          </View>
        }
      />
      <FlatList
        ref={listRef}
        data={clusters}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScrollBeginDrag={() => setPlaying(false)}
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
          });
        }}
        renderItem={({ item }) => {
          const key = placeBucketKey(item.centerLat, item.centerLng);
          return (
            <ClusterSlide
              cluster={item}
              width={width}
              coverAssetId={covers[key] ?? null}
              onSetCover={setCover}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  playBtnPressed: {
    opacity: 0.6,
  },
  playIcon: {
    fontSize: 12,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  counter: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    fontWeight: '700',
  },
  slide: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerBlock: {
    marginBottom: theme.spacing.sm,
  },
  imageWrap: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  hero: {
    aspectRatio: 4 / 5,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surfaceAlt,
  },
  placeholder: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  place: {
    ...theme.type.title,
    marginTop: theme.spacing.md,
    color: theme.colors.ink,
    fontWeight: '800',
  },
  meta: {
    ...theme.type.label,
    marginTop: 4,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  date: {
    ...theme.type.label,
    marginTop: 2,
    color: theme.colors.subtle,
  },
  gridHint: {
    ...theme.type.micro,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    color: theme.colors.subtle,
  },
  gridRow: {
    marginBottom: theme.spacing.sm,
  },
  gridThumb: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.line,
  },
  gridThumbSelected: {
    borderColor: theme.colors.accent,
  },
  gridThumbCover: {
    borderColor: theme.colors.sand,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.sand,
  },
  gridBadgeText: {
    ...theme.type.micro,
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 9,
  },
});
