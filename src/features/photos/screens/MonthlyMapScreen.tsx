import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useOnboarding } from '@/features/onboarding/hooks/useOnboarding';
import { useStamps } from '@/features/stamps/hooks/useStamps';
import { scheduleStampLibrarySyncFromMap } from '@/features/stamps/services/stampLibrarySyncRunner';

import { DEFAULT_MAP_ZOOM, MapCanvas } from '../components/MapCanvas';
import { HomeNavBar } from '../components/HomeNavBar';
import { PhotoPreviewSheet } from '../components/PhotoPreviewSheet';
import { TimeSlider, type TimeRange } from '../components/TimeSlider';
import { VisitChipRow } from '../components/VisitChipRow';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMapTheme } from '../hooks/useMapTheme';
import { useMonthJourney } from '../hooks/useMonthJourney';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePhotoPermission } from '../hooks/usePhotoPermission';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos, resetClusterCellCache } from '../services/cluster';
import { isDevDummyPhotosEnabled } from '../services/dummyPhotos';
import { startMonthImageWarmup } from '../services/monthImageWarmup';
import type { MonthKey, PlaceCluster } from '../types';
import { monthTimeBoundsIso } from '../utils/month';
import { placeBucketKey } from '../utils/placeJourney';

function useTimeRangeForMonth(month: MonthKey): [TimeRange, (value: TimeRange) => void] {
  const bounds = useMemo(() => monthTimeBoundsIso(month), [month]);
  const [monthForRange, setMonthForRange] = useState(month);
  const [timeRange, setTimeRange] = useState<TimeRange>(bounds);

  if (monthForRange !== month) {
    setMonthForRange(month);
    setTimeRange(bounds);
  }

  return [timeRange, setTimeRange];
}

function formatMonthLabel(month: MonthKey): string {
  const [year, mon] = month.split('-');
  return `${year}. ${mon}`;
}

export function MonthlyMapScreen() {
  const router = useRouter();
  const { seen: onboardingSeen } = useOnboarding();
  const { status, isReady } = usePhotoPermission();
  const hasLibraryAccess = status === 'granted' || status === 'limited';
  const hasAccess = hasLibraryAccess || isDevDummyPhotosEnabled();
  const { month } = useCurrentMonth();
  const { themeId } = useMapTheme();
  const { covers, setCover } = usePinCovers(month);
  const { data, isPending, isFetching, isError, refetch, isRefetching } = useMonthlyPhotos(month, {
    enabled: isReady && hasAccess,
  });
  const bounds = useMemo(() => monthTimeBoundsIso(month), [month]);
  const [timeRange, setTimeRange] = useTimeRangeForMonth(month);
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const [selected, setSelected] = useState<PlaceCluster | null>(null);
  // The "위치 없는 사진 / 집 제외" notices are collapsed behind a "!" so the
  // header stays quiet; they're reference info, not something to read every time.
  const [showNotices, setShowNotices] = useState(false);

  const filteredPhotos = useMemo(() => {
    if (!data) {
      return [];
    }
    const fromMs = Date.parse(timeRange.from);
    const toMs = Date.parse(timeRange.to);
    return data.photos.filter((photo) => {
      const t = Date.parse(photo.takenAt);
      return t >= fromMs && t <= toMs;
    });
  }, [data, timeRange.from, timeRange.to]);

  const clusters = useMemo(
    () => clusterPhotos(filteredPhotos, zoom),
    [filteredPhotos, zoom],
  );

  // Debounce zoom→recluster so every camera-idle tick doesn't remount markers.
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onZoomChange = useCallback((next: number) => {
    if (zoomTimerRef.current) {
      clearTimeout(zoomTimerRef.current);
    }
    zoomTimerRef.current = setTimeout(() => {
      setZoom(next);
    }, 180);
  }, []);
  useEffect(() => {
    return () => {
      if (zoomTimerRef.current) {
        clearTimeout(zoomTimerRef.current);
      }
    };
  }, []);

  const { places: journeyPlaces, isResolving } = useMonthJourney(filteredPhotos, {
    // Disk hydrate runs always; network geocode waits until the month GPS pass
    // finishes so progressive batches don't cancel/restart the queue (main jank).
    enabled: Boolean(data) && !isFetching,
    resetKey: month,
  });
  const { unseenCount } = useStamps();

  // Full-album stamp sync — session-once, after first month GPS finishes.
  useEffect(() => {
    if (!isReady || !hasLibraryAccess || isFetching) {
      return;
    }
    scheduleStampLibrarySyncFromMap();
  }, [hasLibraryAccess, isReady, isFetching]);

  // Warm pin covers + a stable photo sample — not cluster list (zoom reclusters
  // used to re-enqueue Image.prefetch on every idle tick).
  const imageWarmKey = useMemo(() => {
    const photos = data?.allPhotos;
    if (!photos || photos.length === 0) {
      return null;
    }
    const first = photos[0]!;
    const last = photos[photos.length - 1]!;
    return `${month}:${photos.length}:${first.assetId}:${last.assetId}`;
  }, [month, data?.allPhotos]);

  useEffect(() => {
    resetClusterCellCache();
  }, [month]);

  useEffect(() => {
    if (!imageWarmKey || !data?.allPhotos) {
      return;
    }
    const priority: string[] = [...Object.values(covers)];
    const sample = data.allPhotos;
    const step = Math.max(1, Math.floor(sample.length / 40));
    for (let i = 0; i < sample.length && priority.length < 80; i += step) {
      priority.push(sample[i]!.assetId);
    }
    startMonthImageWarmup({
      month,
      assetIds: priority,
    });
  }, [imageWarmKey, covers, month, data?.allPhotos]);


  const onSelectCluster = useCallback((cluster: PlaceCluster) => {
    setSelected((prev) => (prev?.id === cluster.id ? null : cluster));
  }, []);

  const selectedPlaceKey = selected
    ? placeBucketKey(selected.centerLat, selected.centerLng)
    : null;

  // First-run gate before the permission gate: explain the app, then ask.
  if (!onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  if (!isReady) {
    return <LoadingView />;
  }

  if (!hasAccess) {
    return <Redirect href="/permission" />;
  }

  if (isPending && !data) {
    return <LoadingView />;
  }

  // Cold start: assets listed but GPS still resolving and no pins yet.
  if (data && data.photos.length === 0 && isFetching) {
    return <LoadingView />;
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StateView
          icon="⚠️"
          title={strings.common.error}
          actionLabel={isRefetching ? strings.common.loading : strings.common.retry}
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  const monthLabel = formatMonthLabel(month);
  // Content destinations live in the thumb-reachable bottom bar; settings is a
  // low-frequency config, so it sits as a quiet link in the header instead.
  const navItems = [
    { href: '/months' as const, label: strings.months.title, icon: 'calendar' as const },
    { href: '/playback' as const, label: strings.playback.title, icon: 'play' as const },
    { href: '/cards' as const, label: strings.cards.listTitle, icon: 'card' as const },
    {
      href: '/stamps' as Href,
      label: strings.stamps.title,
      icon: 'stamp' as const,
      badge: unseenCount > 0,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.hero}>
            <Text style={styles.wordmark}>{strings.brand}</Text>
            <Text style={styles.tagline} numberOfLines={1}>
              {strings.tagline}
            </Text>
            <Text style={styles.monthMeta} numberOfLines={1}>
              {(isFetching || isResolving) && data
                ? strings.map.resolvingLocations
                : strings.map.monthMeta(monthLabel, clusters.length)}
              {journeyPlaces.length === 1 ? ` · ${journeyPlaces[0]}` : ''}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={strings.map.settings}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Text style={styles.actionLabel}>{strings.map.settings}</Text>
            </Pressable>

            {data.noLocationCount > 0 || data.homeExcludedCount > 0 ? (
              <Pressable
                onPress={() => setShowNotices((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityState={{ expanded: showNotices }}
                accessibilityLabel={strings.map.infoToggle}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <View style={[styles.infoDot, showNotices && styles.infoDotActive]}>
                  <Text
                    style={[
                      styles.infoDotText,
                      showNotices && styles.infoDotTextActive,
                    ]}
                  >
                    !
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        </View>

        {showNotices && (data.noLocationCount > 0 || data.homeExcludedCount > 0) ? (
          <View style={styles.noticeRow}>
            {data.noLocationCount > 0 ? (
              <View style={styles.noticeChip}>
                <Text style={styles.notice}>
                  {strings.map.noLocationNotice(data.noLocationCount)}
                </Text>
              </View>
            ) : null}
            {data.homeExcludedCount > 0 ? (
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.noticeChip,
                  pressed && styles.noticeChipPressed,
                ]}
              >
                <Text style={styles.notice}>
                  {strings.map.homeExcludedNotice(data.homeExcludedCount)}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {journeyPlaces.length > 1 ? (
          <View style={styles.journeyChips}>
            <VisitChipRow labels={journeyPlaces} tone="quiet" />
          </View>
        ) : null}

        <View style={styles.mapBlock}>
          <MapCanvas
            clusters={clusters}
            frameKey={month}
            onZoomChange={onZoomChange}
            onSelectCluster={onSelectCluster}
            selectedClusterId={selected?.id ?? null}
            themeId={themeId}
            pinCovers={covers}
          />
          {data.photos.length === 0 ? (
            <View style={styles.emptyOverlay} pointerEvents="box-none">
              <Text style={styles.emptyOverlayText}>
                {data.homeExcludedCount > 0
                  ? strings.map.emptyAllHome
                  : strings.map.emptyMonth}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {data.photos.length > 0 ? (
            <TimeSlider bounds={bounds} value={timeRange} onChange={setTimeRange} />
          ) : null}
          <Button
            title={strings.cards.createTitle}
            variant="accent"
            style={styles.createBtn}
            onPress={() => router.push('/cards/create')}
          />
        </View>
      </View>

      <HomeNavBar items={navItems} />

      <PhotoPreviewSheet
        cluster={selected}
        onClose={() => setSelected(null)}
        coverAssetId={selectedPlaceKey ? covers[selectedPlaceKey] : null}
        onSetCover={setCover}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingTop: 2,
    paddingBottom: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionBtnPressed: {
    opacity: 0.55,
  },
  actionLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.serif,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  hero: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
    paddingRight: theme.spacing.sm,
  },
  wordmark: {
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  tagline: {
    ...theme.type.micro,
    fontFamily: theme.fonts.serif,
    color: theme.colors.inkSoft,
    letterSpacing: -0.2,
    fontSize: 11,
    lineHeight: 14,
  },
  monthMeta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.serif,
    color: theme.colors.subtle,
    marginTop: 1,
  },
  infoDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  infoDotActive: {
    backgroundColor: theme.colors.terracotta,
    borderColor: theme.colors.terracotta,
  },
  infoDotText: {
    ...theme.type.micro,
    fontWeight: '700',
    color: theme.colors.subtle,
    lineHeight: 14,
  },
  infoDotTextActive: {
    color: theme.colors.surface,
  },

  journeyChips: {
    paddingBottom: theme.spacing.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    paddingBottom: theme.spacing.sm,
  },
  noticeChipPressed: {
    backgroundColor: theme.colors.terracottaSoft,
  },
  noticeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  notice: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  mapBlock: {
    flex: 1,
    position: 'relative',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyOverlayText: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: theme.colors.overlay,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  footer: {
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  createBtn: {
    borderRadius: theme.radius.pill,
  },
});
