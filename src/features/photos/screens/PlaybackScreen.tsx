import { useEffect, useMemo, useRef, useState } from 'react';
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

const STRIP_SIZE = 64;

function StripThumb({
  photo,
  selected,
  isCover,
  onPress,
}: {
  photo: PhotoRef;
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
        console.warn('StripThumb uri failed', photo.assetId, error);
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
        styles.stripThumb,
        selected && styles.stripThumbSelected,
        isCover && styles.stripThumbCover,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.stripImage}
          contentFit="cover"
          recyclingKey={photo.assetId}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.stripImage, styles.placeholder]} />
      )}
      {isCover ? (
        <View style={styles.stripBadge}>
          <Text style={styles.stripBadgeText}>{strings.map.coverBadge}</Text>
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

  // Prefer cover when cluster or cover changes.
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

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.imageWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
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
        <View style={styles.stripBlock}>
          <Text style={styles.stripHint}>{strings.playback.stripHint}</Text>
          <FlatList
            horizontal
            data={cluster.photos}
            keyExtractor={(item) => item.assetId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stripList}
            renderItem={({ item }) => (
              <StripThumb
                photo={item}
                selected={item.assetId === activeId}
                isCover={item.assetId === coverAssetId}
                onPress={() => onSelectPhoto(item.assetId)}
              />
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Dwell time per place when auto-playing, in ms. */
const AUTOPLAY_MS = 2800;

/**
 * Storytelling view: steps through clusters in chronological order, by manual
 * swipe or auto-play. A drag pauses auto-play so the user is never fought.
 * Same-place strip sets the pin cover (shared with the map).
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  imageWrap: {
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
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
  stripBlock: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  stripHint: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  stripList: {
    gap: theme.spacing.sm,
    paddingVertical: 2,
  },
  stripThumb: {
    width: STRIP_SIZE,
    height: STRIP_SIZE,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.line,
  },
  stripThumbSelected: {
    borderColor: theme.colors.accent,
  },
  stripThumbCover: {
    borderColor: theme.colors.sand,
  },
  stripImage: {
    width: '100%',
    height: '100%',
  },
  stripBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.sand,
  },
  stripBadgeText: {
    ...theme.type.micro,
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 9,
  },
});
