import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LoadingView } from '@/shared/components/LoadingView';
import { CreateCardFab } from '@/shared/components/CreateCardFab';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useHeldBusy } from '@/shared/hooks/useHeldBusy';
import { useShellBackground } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { useOnboarding } from '@/features/onboarding/hooks/useOnboarding';
import { IndexingBanner } from '@/features/stamps/components/IndexingBanner';
import { useStampLibraryProgress } from '@/features/stamps/hooks/useStampLibraryProgress';
import { scheduleStampLibrarySyncFromMap } from '@/features/stamps/services/stampLibrarySyncRunner';

import { DEFAULT_MAP_ZOOM, MapCanvas } from '../components/MapCanvas';
import { clusterSeedId } from '../components/MapClusterMarker';
import { HomeNavBar } from '../components/HomeNavBar';
import { PhotoPreviewSheet } from '../components/PhotoPreviewSheet';
import { getSharedMonth, useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthEndReminder } from '../hooks/useMonthEndReminder';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { usePhotoPermission } from '../hooks/usePhotoPermission';
import { usePinCovers } from '../hooks/usePinCovers';
import { clusterPhotos, resetClusterCellCache } from '../services/cluster';
import { isDevDummyPhotosEnabled } from '../services/dummyPhotos';
import {
  startMonthImageWarmup,
  startMonthThumbPrewarm,
} from '../services/monthImageWarmup';
import { prefetchNeighborMonths } from '../services/monthWarmup';
import type { MonthKey, PlaceCluster } from '../types';
import { currentMonthKey, shiftMonthKey } from '../utils/month';
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

function SettingsGear({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        fillRule="evenodd"
        stroke={color}
        strokeWidth={0.45}
        strokeLinejoin="round"
        d="M9.82 5.09 L10.23 2.46 L13.77 2.46 L14.18 5.09 L15.35 5.57 L17.49 4.01 L19.99 6.51 L18.43 8.65 L18.91 9.82 L21.54 10.23 L21.54 13.77 L18.91 14.18 L18.43 15.35 L19.99 17.49 L17.49 19.99 L15.35 18.43 L14.18 18.91 L13.77 21.54 L10.23 21.54 L9.82 18.91 L8.65 18.43 L6.51 19.99 L4.01 17.49 L5.57 15.35 L5.09 14.18 L2.46 13.77 L2.46 10.23 L5.09 9.82 L5.57 8.65 L4.01 6.51 L6.51 4.01 L8.65 5.57 Z M15.3 12 A3.3 3.3 0 1 1 8.7 12 A3.3 3.3 0 1 1 15.3 12 Z"
      />
    </Svg>
  );
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
  const insets = useSafeAreaInsets();
  const shellBg = useShellBackground();
  const { colors } = useTheme();
  // Pull chrome closer to the status bar — full inset leaves too much empty top.
  const headerPadTop = Math.max(0, insets.top - 10);
  const { seen: onboardingSeen } = useOnboarding();
  useMonthEndReminder({ promptIfUndetermined: onboardingSeen });
  const { status, isReady } = usePhotoPermission();
  const hasLibraryAccess = status === 'granted' || status === 'limited';
  const hasAccess = hasLibraryAccess || isDevDummyPhotosEnabled();
  const { month, setMonth, canOpenMonth } = useCurrentMonth();
  const { covers, setCover } = usePinCovers(month);
  const {
    data,
    isPending,
    isFetching,
    isError,
    refetch,
    isRefetching,
    isStaleMonth,
  } = useMonthlyPhotos(month, {
    enabled: isReady && hasAccess,
  });
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const [selected, setSelected] = useState<PlaceCluster | null>(null);

  const monthPhotos = data?.photos ?? [];

  const prevMonth = useMemo(() => {
    const next = shiftMonthKey(month, -1);
    return canOpenMonth(next) ? next : null;
  }, [canOpenMonth, month]);
  const nextMonth = useMemo(() => {
    const next = shiftMonthKey(month, 1);
    if (next > currentMonthKey()) {
      return null;
    }
    return canOpenMonth(next) ? next : null;
  }, [canOpenMonth, month]);

  const goPrevMonth = useCallback(() => {
    const next = shiftMonthKey(getSharedMonth(), -1);
    if (canOpenMonth(next)) {
      setMonth(next);
    }
  }, [canOpenMonth, setMonth]);
  const goNextMonth = useCallback(() => {
    const next = shiftMonthKey(getSharedMonth(), 1);
    if (next > currentMonthKey()) {
      return;
    }
    if (canOpenMonth(next)) {
      setMonth(next);
    }
  }, [canOpenMonth, setMonth]);

  // Keep ±1 month GPS warm so ‹ › rarely hits a cold MediaLibrary pass.
  useEffect(() => {
    prefetchNeighborMonths(prevMonth, nextMonth);
  }, [nextMonth, prevMonth]);

  useEffect(() => {
    setSelected(null);
  }, [month]);

  const clusters = useMemo(
    () => clusterPhotos(monthPhotos, zoom),
    [monthPhotos, zoom],
  );
  // Month fact: distinct ~110m GPS spots. Zoom-independent (map pins merge on
  // pinch-out; this count does not). Not dong-collapsed — home skips geocode.
  const placeCount = useMemo(() => {
    const seen = new Set<string>();
    for (const photo of monthPhotos) {
      seen.add(placeBucketKey(photo.lat, photo.lng));
    }
    return seen.size;
  }, [monthPhotos]);

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

  // Location chips removed from home header — geocode only when opening sheets.

  // Full-album stamp sync — session-once, after first month GPS finishes.
  useEffect(() => {
    if (!isReady || !hasLibraryAccess || isFetching || isStaleMonth) {
      return;
    }
    scheduleStampLibrarySyncFromMap();
  }, [hasLibraryAccess, isReady, isFetching, isStaleMonth]);

  useEffect(() => {
    resetClusterCellCache();
  }, [month]);

  const bootBusy = !isReady;
  // Month ‹ › keeps placeholder data — don't force the 1.5s bike for that path.
  const dataBusy = isReady && hasAccess && isPending && !data;
  // Cap at 2s so a long GPS pass doesn't keep the bike up.
  const showLoading = useHeldBusy(bootBusy || dataBusy, 1500, 2000);

  // Middle-path prewarm after month GPS settles (not on every zoom recluster).
  // Skip while the bike is up — pin bake steals frames from the spin.
  useEffect(() => {
    if (!data || isFetching || showLoading || isStaleMonth) {
      return;
    }
    startMonthThumbPrewarm({
      month,
      priorityIds: Object.values(covers),
      monthAssetIds: data.photos.map((p) => p.assetId),
    });
  }, [covers, data, isFetching, isStaleMonth, month, showLoading]);

  // Pin seeds change with zoom grain — bump them to the front only.
  useEffect(() => {
    if (
      !data ||
      isFetching ||
      showLoading ||
      isStaleMonth ||
      clusters.length === 0
    ) {
      return;
    }
    startMonthImageWarmup({
      month,
      assetIds: clusters.map((c) => clusterSeedId(c)),
    });
  }, [clusters, data, isFetching, isStaleMonth, month, showLoading]);

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

  if (isError && !data) {
    return (
      <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
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
    <SafeAreaView style={[styles.safe, shellBg]} edges={['left', 'right']}>
      <View style={[styles.body, { paddingTop: headerPadTop }]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.brandEyebrow, { color: colors.shellInk }]}>
              {strings.brand}
            </Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={{ top: 8, bottom: 2, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={strings.map.settings}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <SettingsGear color={colors.shellInkSoft} />
              </Pressable>
            </View>
          </View>

          <View style={styles.headerTitleRow}>
            <Pressable
              onPress={goPrevMonth}
              disabled={prevMonth == null}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={strings.map.monthPrev}
              style={({ pressed }) => [
                styles.monthEdgeBtn,
                pressed && prevMonth != null && styles.monthEdgeBtnPressed,
              ]}
            >
              <Text
                style={[
                  styles.monthEdgeChevron,
                  { color: colors.shellInk },
                  prevMonth == null && styles.monthEdgeChevronOff,
                ]}
              >
                ‹
              </Text>
            </Pressable>

            <View style={styles.hero}>
              <Pressable
                onPress={() => router.push('/months')}
                accessibilityRole="button"
                accessibilityLabel={strings.months.title}
                hitSlop={4}
                style={styles.heroTitleHit}
              >
                <Text style={[styles.wordmark, { color: colors.shellInk }]} numberOfLines={1}>
                  {strings.map.monthTitle(monthNumber)}
                </Text>
              </Pressable>
              <Text style={[styles.monthMeta, { color: colors.shellSubtle }]} numberOfLines={1}>
                {(isFetching || isStaleMonth || !data)
                  ? strings.map.resolvingLocations
                  : strings.map.monthMeta(monthLabel, placeCount)}
              </Text>
            </View>

            <Pressable
              onPress={goNextMonth}
              disabled={nextMonth == null}
              hitSlop={{ top: 2, bottom: 10, left: 8, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={strings.map.monthNext}
              style={({ pressed }) => [
                styles.monthEdgeBtn,
                pressed && nextMonth != null && styles.monthEdgeBtnPressed,
              ]}
            >
              <Text
                style={[
                  styles.monthEdgeChevron,
                  { color: colors.shellInk },
                  nextMonth == null && styles.monthEdgeChevronOff,
                ]}
              >
                ›
              </Text>
            </Pressable>
          </View>
        </View>

        <HomeIndexingBanner />

        <View style={[styles.mapBlock, isStaleMonth && styles.mapBlockStale]}>
          <MapCanvas
            clusters={clusters}
            // pending→ready bumps frameKey so camera refits the real month pins.
            frameKey={isStaleMonth ? `${month}:pending` : month}
            onZoomChange={onZoomChange}
            onSelectCluster={onSelectCluster}
            selectedClusterId={selectedSeedId}
            pinCovers={covers}
          />
          {!isStaleMonth && data && data.photos.length === 0 ? (
            <View style={styles.emptyOverlay} pointerEvents="box-none">
              <Text style={styles.emptyOverlayText}>
                {data.homeExcludedCount > 0
                  ? strings.map.emptyAllHome
                  : strings.map.emptyMonth}
              </Text>
            </View>
          ) : null}
          <View style={styles.fabWrap} pointerEvents="box-none">
            <CreateCardFab onPress={() => router.push('/cards/create')} />
          </View>
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
  },
  body: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 0,
    paddingBottom: 2,
    gap: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthEdgeBtn: {
    width: 40,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthEdgeBtnPressed: {
    opacity: 0.45,
  },
  monthEdgeChevron: {
    fontFamily: theme.fonts.sans,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
    color: theme.colors.ink,
    opacity: 0.55,
  },
  monthEdgeChevronOff: {
    opacity: 0.18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPressed: {
    opacity: 0.55,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
    paddingHorizontal: theme.spacing.xs,
  },
  heroTitleHit: {
    alignItems: 'center',
  },
  brandEyebrow: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  wordmark: {
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.4,
    fontWeight: '700',
    textAlign: 'center',
  },
  monthMeta: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    marginTop: 1,
    textAlign: 'center',
  },
  mapBlock: {
    flex: 1,
    position: 'relative',
    marginTop: theme.spacing.xs,
  },
  mapBlockStale: {
    opacity: 0.55,
  },
  fabWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: theme.spacing.md,
    paddingBottom: theme.spacing.md,
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
});
