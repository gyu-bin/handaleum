import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';

import { useOnboarding } from '@/features/onboarding/hooks/useOnboarding';
import { IndexingBanner } from '@/features/stamps/components/IndexingBanner';
import { useStampLibraryProgress } from '@/features/stamps/hooks/useStampLibraryProgress';
import { scheduleStampLibrarySyncFromMap } from '@/features/stamps/services/stampLibrarySyncRunner';

import { DEFAULT_MAP_ZOOM, MapCanvas } from '../components/MapCanvas';
import { clusterSeedId } from '../components/MapClusterMarker';
import { HomeNavBar } from '../components/HomeNavBar';
import { PhotoPreviewSheet } from '../components/PhotoPreviewSheet';
import { VisitChipRow } from '../components/VisitChipRow';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useJourneyPathOrder } from '../hooks/useJourneyPathOrder';
import { useMonthJourney } from '../hooks/useMonthJourney';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePhotoPermission } from '../hooks/usePhotoPermission';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos, resetClusterCellCache } from '../services/cluster';
import { isDevDummyPhotosEnabled } from '../services/dummyPhotos';
import {
  startMonthImageWarmup,
  startMonthThumbPrewarm,
} from '../services/monthImageWarmup';
import type { MonthKey, PlaceCluster } from '../types';
import { placeBucketKey } from '../utils/placeJourney';

/** Own the progress store so scan ticks don't re-render the whole map tree. */
function HomeIndexingBanner() {
  const progress = useStampLibraryProgress();
  return <IndexingBanner progress={progress} />;
}

function formatMonthLabel(month: MonthKey): string {
  const [year, mon] = month.split('-');
  return `${year}. ${mon}`;
}

/** Stable dock items — stamp badge is owned by HomeNavBar. */
const MAP_NAV_ITEMS = [
  { href: '/months' as const, label: strings.months.title, icon: 'calendar' as const },
  { href: '/playback' as const, label: strings.playback.title, icon: 'play' as const },
  { href: '/cards' as const, label: strings.cards.listTitle, icon: 'card' as const },
  {
    href: '/stamps' as Href,
    label: strings.stamps.title,
    icon: 'stamp' as const,
  },
];

export function MonthlyMapScreen() {
  const router = useRouter();
  const { seen: onboardingSeen } = useOnboarding();
  const { status, isReady } = usePhotoPermission();
  const hasLibraryAccess = status === 'granted' || status === 'limited';
  const hasAccess = hasLibraryAccess || isDevDummyPhotosEnabled();
  const { month } = useCurrentMonth();
  const { covers, setCover } = usePinCovers(month);
  const { showPathOrder, togglePathOrder } = useJourneyPathOrder();
  const { data, isPending, isFetching, isError, refetch, isRefetching } = useMonthlyPhotos(month, {
    enabled: isReady && hasAccess,
  });
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const [selected, setSelected] = useState<PlaceCluster | null>(null);
  // The "위치 없는 사진 / 집 제외" notices are collapsed behind a "!" so the
  // header stays quiet; they're reference info, not something to read every time.
  const [showNotices, setShowNotices] = useState(false);

  const monthPhotos = data?.photos ?? [];

  const clusters = useMemo(
    () => clusterPhotos(monthPhotos, zoom),
    [monthPhotos, zoom],
  );

  // Debounce zoom→recluster so every camera-idle tick doesn't remount markers.
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onZoomChange = useCallback((next: number) => {
    if (zoomTimerRef.current) {
      clearTimeout(zoomTimerRef.current);
    }
    zoomTimerRef.current = setTimeout(() => {
      setZoom(next);
    }, 280);
  }, []);
  useEffect(() => {
    return () => {
      if (zoomTimerRef.current) {
        clearTimeout(zoomTimerRef.current);
      }
    };
  }, []);

  const { places: journeyPlaces, isResolving } = useMonthJourney(monthPhotos, {
    // Disk hydrate runs always; network geocode waits until the month GPS pass
    // finishes so progressive batches don't cancel/restart the queue (main jank).
    enabled: Boolean(data) && !isFetching,
    resetKey: month,
  });

  // Full-album stamp sync — session-once, after first month GPS finishes.
  useEffect(() => {
    if (!isReady || !hasLibraryAccess || isFetching) {
      return;
    }
    scheduleStampLibrarySyncFromMap();
  }, [hasLibraryAccess, isReady, isFetching]);

  useEffect(() => {
    resetClusterCellCache();
  }, [month]);

  // Middle-path prewarm after month GPS settles (not on every zoom recluster).
  useEffect(() => {
    if (!data || isFetching) {
      return;
    }
    startMonthThumbPrewarm({
      month,
      priorityIds: Object.values(covers),
      monthAssetIds: data.photos.map((p) => p.assetId),
    });
  }, [covers, data, isFetching, month]);

  // Pin seeds change with zoom grain — bump them to the front only.
  useEffect(() => {
    if (!data || isFetching || clusters.length === 0) {
      return;
    }
    startMonthImageWarmup({
      month,
      assetIds: clusters.map((c) => clusterSeedId(c)),
    });
  }, [clusters, data, isFetching, month]);

  // Keep the open pin across zoom: cluster.id includes grain and changes, but
  // the seed asset usually survives. Drop selection only if the seed is gone.
  useEffect(() => {
    if (!selected) {
      return;
    }
    const seed = clusterSeedId(selected);
    const match =
      clusters.find((c) => clusterSeedId(c) === seed) ??
      clusters.find((c) => c.photos.some((p) => p.assetId === seed));
    if (!match) {
      setSelected(null);
      return;
    }
    if (
      match.id !== selected.id ||
      match.photos.length !== selected.photos.length
    ) {
      setSelected(match);
    }
  }, [clusters, selected]);

  const onSelectCluster = useCallback((cluster: PlaceCluster) => {
    setSelected((prev) =>
      prev && clusterSeedId(prev) === clusterSeedId(cluster) ? null : cluster,
    );
  }, []);

  const selectedSeedId = selected ? clusterSeedId(selected) : null;

  const selectedPlaceKey = selected
    ? placeBucketKey(selected.centerLat, selected.centerLng)
    : null;

  const bootBusy = !isReady;
  const dataBusy =
    isReady &&
    hasAccess &&
    ((isPending && !data) ||
      Boolean(data && data.photos.length === 0 && isFetching));
  // One held flag — boot→data handoff must not remount LoadingView (bike hitch).
  const showLoading = useHeldBusy(bootBusy || dataBusy, 1500);

  // First-run gate before the permission gate: explain the app, then ask.
  if (!onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  if (isReady && !hasAccess) {
    return <Redirect href="/permission" />;
  }

  if (showLoading) {
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
  const monthNumber = Number(month.split('-')[1] ?? 0);
  // Content destinations live in the thumb-reachable bottom bar; settings is a
  // low-frequency config, so it sits as a quiet link in the header instead.

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.hero}>
            <Text style={styles.brandEyebrow}>{strings.brand}</Text>
            <Text style={styles.wordmark} numberOfLines={1}>
              {strings.map.monthTitle(monthNumber)}
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

        <HomeIndexingBanner />

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
            selectedClusterId={selectedSeedId}
            pinCovers={covers}
            showPathOrder={showPathOrder}
            onTogglePathOrder={togglePathOrder}
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
          <Button
            title={strings.cards.createTitle}
            variant="primary"
            style={styles.createBtn}
            onPress={() => router.push('/cards/create')}
          />
        </View>
      </View>

      <HomeNavBar items={MAP_NAV_ITEMS} />

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
    backgroundColor: theme.colors.background,
  },
  body: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 2,
    paddingBottom: theme.spacing.xs,
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
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  hero: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 1,
    paddingRight: theme.spacing.sm,
  },
  brandEyebrow: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  wordmark: {
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    fontWeight: '700',
  },
  monthMeta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
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
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
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
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  noticeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
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
    marginTop: theme.spacing.xs,
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
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
  },
  createBtn: {
    borderRadius: theme.radius.sm,
  },
});
