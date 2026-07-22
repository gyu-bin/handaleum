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
import { clusterPhotos } from '../services/cluster';
import { resolveAssetUri } from '../services/mediaLibrary';
import type { PlaceCluster } from '../types';

function ClusterSlide({
  cluster,
  width,
}: {
  cluster: PlaceCluster;
  width: number;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const first = cluster.photos[0];

  useEffect(() => {
    if (!first) {
      return;
    }
    let cancelled = false;
    void resolveAssetUri(first.assetId).then((next) => {
      if (!cancelled) {
        setUri(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [first]);

  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.imageWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </View>
      <Text style={styles.meta}>
        {strings.map.clusterCount(cluster.photos.length)}
      </Text>
      <Text style={styles.date}>
        {new Date(first?.takenAt ?? '').toLocaleString('ko-KR')}
      </Text>
    </View>
  );
}

/** Dwell time per place when auto-playing, in ms. */
const AUTOPLAY_MS = 2800;

/**
 * Storytelling view: steps through clusters in chronological order, by manual
 * swipe or auto-play. A drag pauses auto-play so the user is never fought.
 */
export function PlaybackScreen() {
  const { width } = useWindowDimensions();
  const { month } = useCurrentMonth();
  const { data, isPending, isError, refetch } = useMonthlyPhotos(month);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<FlatList<PlaceCluster>>(null);
  // Read the live index inside the interval without re-arming it every step.
  const indexRef = useRef(0);
  indexRef.current = index;

  const clusters = useMemo(() => {
    if (!data) {
      return [];
    }
    return clusterPhotos(data.photos, 14).sort(
      (a, b) => Date.parse(a.photos[0]!.takenAt) - Date.parse(b.photos[0]!.takenAt),
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
        setPlaying(false); // stop at the end of the recap
        return;
      }
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [playing, clusters.length]);

  const togglePlay = () => {
    setPlaying((prev) => {
      if (!prev && index >= clusters.length - 1) {
        // Restart from the beginning when replaying from the end.
        listRef.current?.scrollToIndex({ index: 0, animated: false });
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
              accessibilityLabel={playing ? strings.playback.pause : strings.playback.play}
              style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
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
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => <ClusterSlide cluster={item} width={width} />}
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
  meta: {
    ...theme.type.title,
    marginTop: theme.spacing.md,
    color: theme.colors.ink,
    fontWeight: '800',
  },
  date: {
    ...theme.type.label,
    marginTop: 2,
    color: theme.colors.inkSoft,
  },
});
