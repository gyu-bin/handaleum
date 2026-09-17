import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter, type Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { LoadingView } from '@/shared/components/LoadingView';
import { CreateCardFab } from '@/shared/components/CreateCardFab';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellBackground } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';
import {
  getAndroidLocationTipSeen,
  setAndroidLocationTipSeen,
} from '@/lib/storage';

import { useOnboarding } from '@/features/onboarding/hooks/useOnboarding';
import { IndexingBanner } from '@/features/stamps/components/IndexingBanner';
import { useStampLibraryProgress } from '@/features/stamps/hooks/useStampLibraryProgress';
import { useStampSync } from '@/features/stamps/hooks/useStampSync';
import { scheduleStampLibrarySyncFromMap } from '@/features/stamps/services/stampLibrarySyncRunner';

import { DEFAULT_MAP_ZOOM, MapCanvas } from '../components/MapCanvas';
import { clusterSeedId } from '../components/MapClusterMarker';
import { AndroidLocationTipModal } from '../components/AndroidLocationTipModal';
import { HomeNavBar } from '../components/HomeNavBar';
import { APP_NAV_ITEMS } from '../constants/appNav';
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

/** Floating month chip label — caret is a separate glyph beside the text. */
function formatMonthChip(month: MonthKey): string {
  const [year, mon] = month.split('-');
  const monthNumber = Number(mon);
  if (!year || !Number.isFinite(monthNumber) || monthNumber < 1) {
    return month;
  }
  return `${year}년 ${monthNumber}월`;
}

function SettingsGear({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
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
const MAP_NAV_ITEMS = APP_NAV_ITEMS;

/** Approx HomeNavBar chrome height above home-indicator. */
const NAV_BAR_CONTENT = 54;

export function MonthlyMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shellBg = useShellBackground();
  const { colors } = useTheme();
  const { seen: onboardingSeen } = useOnboarding();
  useMonthEndReminder({ promptIfUndetermined: onboardingSeen });
  const { status, isReady } = usePhotoPermission();
  const hasLibraryAccess = status === 'granted' || status === 'limited';
  const hasAccess = hasLibraryAccess || isDevDummyPhotosEnabled();
  const { month, setMonth, canOpenMonth } = useCurrentMonth();
  const { covers, setCover } = usePinCovers(month);
  const [androidTipOpen, setAndroidTipOpen] = useState(
    () => Platform.OS === 'android' && !getAndroidLocationTipSeen(),
  );
  const onAndroidTipConfirm = useCallback(() => {
    setAndroidLocationTipSeen();
    setAndroidTipOpen(false);
  }, []);
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

  const monthPhotos = useMemo(() => data?.photos ?? [], [data?.photos]);

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

  // Keep ±1 month GPS warm so month chip rarely hits a cold MediaLibrary pass.
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

  // New 동 in this month → unseen (nav dot + 발도장 overlay). Current month only.
  useStampSync(month, data?.allPhotos, {
    enabled: isReady && hasLibraryAccess && !isFetching && !isStaleMonth,
  });

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

  // Boot only — keep the map visible while month GPS resolves (pin layer stale).
  const bootBusy = !isReady;
  const showLoading = bootBusy;

  // Middle-path prewarm after month GPS settles (not on every zoom recluster).
  // Skip while the loader is visible — pin baking competes for animation frames.
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

  const monthChip = formatMonthChip(month);
  const previewBottom =
    NAV_BAR_CONTENT + Math.max(insets.bottom, 4);
  const chromeTop = Math.max(insets.top, 12) + 8;

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['left', 'right']}>
      <View style={styles.body}>
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

          <View
            pointerEvents="box-none"
            style={[styles.chromeTop, { top: chromeTop }]}
          >
            <View style={styles.monthChipRow}>
              <Pressable
                onPress={goPrevMonth}
                disabled={prevMonth == null}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.map.monthPrev}
                style={({ pressed }) => [
                  styles.edgeChip,
                  pressed && prevMonth != null && styles.chipPressed,
                  prevMonth == null && styles.edgeChipOff,
                ]}
              >
                <Text style={[styles.edgeChevron, { color: colors.shellInk }]}>
                  ‹
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/months')}
                accessibilityRole="button"
                accessibilityLabel={strings.months.title}
                style={({ pressed }) => [
                  styles.monthChip,
                  pressed && styles.chipPressed,
                ]}
              >
                <Text
                  style={[styles.monthChipText, { color: colors.shellInk }]}
                  numberOfLines={1}
                >
                  {monthChip}
                </Text>
                <Svg
                  width={12}
                  height={12}
                  viewBox="0 0 12 12"
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  <Path
                    d="M3 4.5 L6 7.5 L9 4.5"
                    stroke={colors.shellSubtle}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </Pressable>

              <Pressable
                onPress={goNextMonth}
                disabled={nextMonth == null}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.map.monthNext}
                style={({ pressed }) => [
                  styles.edgeChip,
                  pressed && nextMonth != null && styles.chipPressed,
                  nextMonth == null && styles.edgeChipOff,
                ]}
              >
                <Text style={[styles.edgeChevron, { color: colors.shellInk }]}>
                  ›
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => router.push('/settings' as Href)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={strings.map.settings}
              style={({ pressed }) => [
                styles.settingsBtn,
                pressed && styles.chipPressed,
              ]}
            >
              <SettingsGear color={colors.shellInk} />
            </Pressable>
          </View>

          <View style={styles.bannerSlot} pointerEvents="box-none">
            <HomeIndexingBanner />
          </View>

          {!isStaleMonth && data && data.photos.length === 0 ? (
            <View style={styles.emptyHint} pointerEvents="none">
              <Text style={styles.emptyHintText}>
                {data.homeExcludedCount > 0
                  ? strings.map.emptyAllHome
                  : data.noLocationCount > 0
                    ? strings.map.emptyNoLocation
                    : strings.map.emptyMonth}
              </Text>
            </View>
          ) : null}

          {(isPending || isStaleMonth || isFetching) && !data?.photos.length ? (
            <View style={styles.pinLoading} pointerEvents="none">
              <Text style={styles.pinLoadingText}>
                {strings.map.resolvingLocations}
              </Text>
            </View>
          ) : null}

          <View style={styles.fabWrap} pointerEvents="box-none">
            <CreateCardFab onPress={() => router.push('/cards/create')} />
          </View>
        </View>
      </View>

      <HomeNavBar items={MAP_NAV_ITEMS} />

      <AndroidLocationTipModal
        visible={androidTipOpen}
        onConfirm={onAndroidTipConfirm}
      />

      <PhotoPreviewSheet
        cluster={selected}
        onClose={() => setSelected(null)}
        coverAssetId={selectedPlaceKey ? covers[selectedPlaceKey] : null}
        onSetCover={setCover}
        variant="compact"
        bottomOffset={previewBottom}
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
  mapBlock: {
    flex: 1,
    position: 'relative',
  },
  mapBlockStale: {
    opacity: 0.92,
  },
  chromeTop: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 4,
  },
  monthChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  monthChip: {
    height: 44,
    paddingLeft: 15,
    paddingRight: 12,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    maxWidth: 210,
  },
  monthChipText: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  edgeChip: {
    width: 36,
    height: 44,
    borderRadius: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  edgeChipOff: {
    opacity: 0.35,
  },
  edgeChevron: {
    fontFamily: theme.fonts.sans,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  chipPressed: {
    opacity: 0.72,
  },
  bannerSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 3,
  },
  emptyHint: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 108,
    alignItems: 'flex-start',
    zIndex: 3,
  },
  emptyHintText: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: theme.colors.inkSoft,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
  },
  pinLoading: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 108,
    alignItems: 'flex-start',
    zIndex: 3,
  },
  pinLoadingText: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: theme.colors.subtle,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fabWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
});
