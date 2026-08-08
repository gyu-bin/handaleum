import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FlatList,
  Platform,
  type ListRenderItemInfo,
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
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';

import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useGridThumbUri } from '../hooks/useGridThumbUri';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos } from '../services/cluster';
import {
  resolveAssetUri,
  syncAssetDisplayUri,
} from '../services/mediaLibrary';
import type { PhotoRef, PlaceCluster } from '../types';
import {
  placeBucketKey,
  resolveClusterDetailLabel,
} from '../utils/placeJourney';

const GRID_COLS = 3;
const HERO_SIZE = 256;
const THUMB_SIZE = 128;
const ROW_GAP = theme.spacing.sm;

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
  const uri = useGridThumbUri(photo.assetId, THUMB_SIZE);

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
          transition={0}
          priority="low"
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
          photo={photo}
          size={cell}
          selected={photo.assetId === activeId}
          isCover={photo.assetId === coverId}
          onPress={() => onSelectPhoto(photo.assetId)}
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

  const pad = theme.spacing.lg;
  const contentW = width - pad * 2;
  const cell = (contentW - ROW_GAP * (GRID_COLS - 1)) / GRID_COLS;
  const rowHeight = cell + ROW_GAP;

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
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [activePhoto, cluster]);

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

  const listHeader = useMemo(
    () => (
      <View>
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
        <View style={styles.imageWrap}>
          {uri ? (
            <Image
              source={{ uri }}
              style={[styles.hero, { width: contentW }]}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={`${activeId}-${HERO_SIZE}`}
              priority="high"
              transition={0}
            />
          ) : (
            <View
              style={[styles.hero, styles.placeholder, { width: contentW }]}
            />
          )}
        </View>
        {cluster.photos.length > 1 ? (
          <Text style={styles.gridHint}>{strings.playback.gridHint}</Text>
        ) : null}
      </View>
    ),
    [
      activeId,
      chapterDay,
      cluster.photos.length,
      contentW,
      placeText,
      uri,
    ],
  );

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
    <FlatList
      style={styles.list}
      data={thumbRows}
      keyExtractor={(row) => row.key}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={3}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={Platform.OS === 'android'}
      getItemLayout={getItemLayout}
      renderItem={renderRow}
      extraData={`${activeId}:${coverId}`}
    />
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
  gridContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
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
    aspectRatio: 1,
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
