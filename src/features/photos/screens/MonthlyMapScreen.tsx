import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { LoadingView } from '@/shared/components/LoadingView';
import { StateView } from '@/shared/components/StateView';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { useOnboarding } from '@/features/onboarding';

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
import { clusterPhotos } from '../services/cluster';
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
  const hasAccess = status === 'granted' || status === 'limited';
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

  const { places: journeyPlaces } = useMonthJourney(filteredPhotos);
  const journeyLine = strings.map.monthJourney(journeyPlaces);

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
  const monthNumber = Number(month.split('-')[1]);
  // Content destinations live in the thumb-reachable bottom bar; settings is a
  // low-frequency config, so it sits as a quiet link in the header instead.
  const navItems = [
    { href: '/months' as const, label: strings.months.title },
    { href: '/playback' as const, label: strings.playback.title },
    { href: '/cards' as const, label: strings.cards.listTitle },
    { href: '/insights' as const, label: strings.insights.title },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.topRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.wordmark}>{strings.brand}</Text>
              <Text style={styles.monthTitle} numberOfLines={1}>
                {strings.map.monthTitle(monthNumber)}
              </Text>
              <Text style={styles.monthMeta} numberOfLines={1}>
                {isFetching && data
                  ? strings.map.resolvingLocations
                  : strings.map.monthMeta(monthLabel, clusters.length)}
              </Text>
            </View>
            <View style={styles.topActions}>
              <Pressable
                onPress={() => router.push('/settings')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={strings.map.settings}
                style={({ pressed }) => [
                  styles.settingsBtn,
                  pressed && styles.settingsBtnPressed,
                ]}
              >
                <Text style={styles.settingsText}>{strings.map.settings}</Text>
              </Pressable>
              {data.noLocationCount > 0 || data.homeExcludedCount > 0 ? (
                <Pressable
                  onPress={() => setShowNotices((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showNotices }}
                  accessibilityLabel={strings.map.infoToggle}
                  style={({ pressed }) => [
                    styles.infoBtn,
                    showNotices && styles.infoBtnActive,
                    pressed && styles.infoBtnPressed,
                  ]}
                >
                  <Text
                    style={[styles.infoBtnText, showNotices && styles.infoBtnTextActive]}
                  >
                    !
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {journeyLine ? (
            <View style={styles.journeyBlock}>
              <Text style={styles.journey} numberOfLines={1}>
                {journeyLine}
              </Text>
              {journeyPlaces.length > 1 ? (
                <VisitChipRow labels={journeyPlaces} />
              ) : null}
            </View>
          ) : null}

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
        </View>

        {data.photos.length === 0 ? (
          <View style={styles.empty}>
            <StateView
              icon="📷"
              title={
                data.homeExcludedCount > 0
                  ? strings.map.emptyAllHome
                  : strings.map.emptyMonth
              }
            />
            {data.allPhotos.length > 0 ? (
              <Button
                title={strings.cards.createTitle}
                variant="accent"
                onPress={() => router.push('/cards/create')}
              />
            ) : null}
          </View>
        ) : (
          <>
            <MapCanvas
              clusters={clusters}
              frameKey={month}
              onZoomChange={setZoom}
              onSelectCluster={onSelectCluster}
              selectedClusterId={selected?.id ?? null}
              themeId={themeId}
              pinCovers={covers}
            />
            <View style={styles.footer}>
              <TimeSlider bounds={bounds} value={timeRange} onChange={setTimeRange} />
              <Button
                title={strings.cards.createTitle}
                variant="accent"
                onPress={() => router.push('/cards/create')}
              />
            </View>
          </>
        )}
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
  panel: {
    flex: 1,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
  },
  header: {
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  /** Settings + the notices "!" stacked in the top-right corner. */
  topActions: {
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  settingsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  settingsBtnPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  settingsText: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  /** Eyebrow, not a headline — the month below it is the loud thing. */
  wordmark: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    letterSpacing: 3.2,
  },
  monthTitle: {
    ...theme.type.display,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
  },
  monthMeta: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  journeyBlock: {
    gap: theme.spacing.sm,
  },
  journey: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  infoBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  infoBtnActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  infoBtnPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  infoBtnText: {
    ...theme.type.micro,
    fontWeight: '700',
    color: theme.colors.subtle,
    lineHeight: 14,
  },
  infoBtnTextActive: {
    color: theme.colors.white,
  },
  noticeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  noticeChipPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  noticeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  notice: {
    ...theme.type.micro,
    color: theme.colors.subtle,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  footer: {
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
});
