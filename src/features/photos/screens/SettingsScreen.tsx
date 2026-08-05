import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { strings } from '@/shared/constants/strings';
import { formatProPriceKrw, IS_MONETIZATION_LIVE } from '@/shared/constants/pricing';
import { theme } from '@/shared/constants/theme';
import {
  isStampLibrarySyncing,
  startStampLibrarySync,
  subscribeStampLibrarySync,
} from '@/features/stamps/services/stampLibrarySyncRunner';
import {
  getStampScanDebug,
  type StampLibraryProgress,
} from '@/features/stamps/services/stampBackfill';
import { useStampLibraryProgress } from '@/features/stamps/hooks/useStampLibraryProgress';
import { ProPaywallModal } from '@/features/insights/components/ProPaywallModal';
import { useIsPro } from '@/features/insights/hooks/useIsPro';

import { useHomeLocation } from '../hooks/useHomeLocation';
import { useDevDummyPhotos } from '../hooks/useDevDummyPhotos';
import { photosQueryKeys } from '../hooks/photosQueryKeys';
import { geocodeQueueDebug } from '../services/geocodeQueue';
import { getVisitResolveDebug } from '../services/placeResolve';
import { DEFAULT_HOME_RADIUS_M } from '../services/homeLocationStorage';

const RADIUS_CHOICES = [100, 300, 500, 1000] as const;

function radiusLabel(radiusM: number): string {
  return radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`;
}

function formatCount(n: number): string {
  return n.toLocaleString('ko-KR');
}

function progressLine(progress: StampLibraryProgress): string {
  if (progress.phase === 'gps') {
    if (progress.assetTotal <= 0) {
      return strings.map.indexingPreparing;
    }
    return `${strings.map.indexingPhotos}  ${strings.map.indexingPhotoCount(
      formatCount(progress.assetScanned),
      formatCount(progress.assetTotal),
    )}`;
  }
  if (progress.phase === 'geocode') {
    if (progress.chunkTotal > 0) {
      return `${strings.map.indexingPlaces}  ${progress.chunkDone}/${progress.chunkTotal}`;
    }
    return strings.map.indexingPlacesEmpty;
  }
  if (progress.phase === 'done') {
    return progress.photoCount > 0
      ? `${strings.map.indexingDone}  ${strings.map.indexingDoneDetail(
          formatCount(progress.photoCount),
        )}`
      : strings.map.indexingDone;
  }
  return strings.settings.albumSyncing;
}

function progressRatio(progress: StampLibraryProgress): number {
  if (progress.phase === 'gps' && progress.assetTotal > 0) {
    return Math.min(1, progress.assetScanned / progress.assetTotal);
  }
  if (progress.phase === 'geocode' && progress.chunkTotal > 0) {
    return Math.min(1, progress.chunkDone / progress.chunkTotal);
  }
  if (progress.phase === 'done') {
    return 1;
  }
  return 0.06;
}

function diagLine(): string {
  const q = geocodeQueueDebug();
  const month = getVisitResolveDebug();
  const scan = getStampScanDebug();
  const elapsedSec =
    scan.startedAt > 0 ? Math.round((Date.now() - scan.startedAt) / 1000) : 0;
  const monthPart = !month
    ? strings.settings.diag.monthIdle
    : strings.settings.diag.month(
        month.resolvedBuckets,
        month.cachedBuckets,
        month.totalBuckets,
        month.failedBuckets,
        month.finished,
      );
  const scanPart =
    scan.phase === 'idle'
      ? strings.settings.diag.scanIdle
      : scan.phase === 'gps'
        ? strings.settings.diag.scanGps(elapsedSec)
        : scan.phase === 'geocode'
          ? strings.settings.diag.scanGeocode(
              scan.chunkDone,
              scan.chunkTotal,
              elapsedSec,
            )
          : strings.settings.diag.scanDone;
  return [
    strings.settings.diag.queue(
      q.interactive,
      q.background,
      q.backoffMs,
      q.done,
      q.failed,
    ),
    monthPart,
    scanPart,
  ].join(' · ');
}

function runningBundleLabel(): string {
  if (Updates.isEmbeddedLaunch || !Updates.updateId) {
    return strings.settings.buildEmbedded;
  }
  const at = Updates.createdAt;
  const publishedAt = at
    ? `${at.getMonth() + 1}/${at.getDate()} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
    : '?';
  return strings.settings.buildOta(publishedAt, Updates.updateId.slice(0, 8));
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { home, setHome, clearHome } = useHomeLocation();
  const { isPro, isBusy, error: proError, purchase, restore } = useIsPro();
  const { enabled: dummyEnabled, setEnabled: setDummyEnabled } = useDevDummyPhotos();
  const indexing = useStampLibraryProgress();
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [albumSyncOpen, setAlbumSyncOpen] = useState(false);
  const [albumSyncing, setAlbumSyncing] = useState(isStampLibrarySyncing);
  const [devOpen, setDevOpen] = useState(false);
  const [diag, setDiag] = useState(diagLine);

  useEffect(() => subscribeStampLibrarySync(setAlbumSyncing), []);

  useEffect(() => {
    if (!__DEV__ || !devOpen) {
      return;
    }
    const timer = setInterval(() => setDiag(diagLine()), 1000);
    return () => clearInterval(timer);
  }, [devOpen]);

  useEffect(() => {
    if (isPro) {
      setPaywallOpen(false);
    }
  }, [isPro]);

  const radius = home?.radiusM ?? DEFAULT_HOME_RADIUS_M;
  const showProgress =
    albumSyncing ||
    indexing.phase === 'gps' ||
    indexing.phase === 'geocode' ||
    indexing.phase === 'done';

  const captureCurrentLocation = async () => {
    setError(null);
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError(strings.settings.locationDenied);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setHome({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radiusM: radius,
      });
    } catch {
      setError(strings.settings.locationFailed);
    } finally {
      setIsLocating(false);
    }
  };

  const confirmAlbumSync = () => {
    setAlbumSyncOpen(false);
    void queryClient.invalidateQueries({ queryKey: photosQueryKeys.all });
    void startStampLibrarySync({ force: true });
  };

  const fill = progressRatio(indexing);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={strings.settings.title} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          showProgress && { paddingBottom: 88 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* A: section labels + spacing only — no list rules */}
        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{strings.settings.albumSection}</Text>
          <Pressable
            onPress={() => setAlbumSyncOpen(true)}
            disabled={albumSyncing}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              pressed && !albumSyncing && styles.pressed,
              albumSyncing && styles.rowDisabled,
            ]}
          >
            <Text style={styles.rowTitle}>
              {albumSyncing
                ? strings.settings.albumSyncing
                : strings.settings.albumSync}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{strings.settings.homeSection}</Text>
          <Pressable
            onPress={() => void captureCurrentLocation()}
            disabled={isLocating}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              pressed && !isLocating && styles.pressed,
            ]}
          >
            <Text style={styles.rowTitle}>
              {isLocating
                ? strings.settings.locating
                : strings.settings.useCurrentLocation}
            </Text>
            <View style={styles.rowTrailing}>
              <Text style={styles.rowValue}>
                {home
                  ? strings.settings.homeSet(home.radiusM)
                  : strings.settings.homeUnset}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
          {home ? (
            <>
              <View style={styles.radiusRow}>
                {RADIUS_CHOICES.map((choice) => {
                  const active = choice === home.radiusM;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => setHome({ ...home, radiusM: choice })}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.chip, active && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextOn]}>
                        {radiusLabel(choice)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={clearHome}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowMuted}>{strings.settings.clearHome}</Text>
              </Pressable>
            </>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {IS_MONETIZATION_LIVE ? (
          <View style={styles.group}>
            <Text style={styles.sectionLabel}>{strings.settings.proSection}</Text>
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{strings.settings.proSection}</Text>
              <Text style={styles.rowValue}>
                {isPro ? strings.settings.proOn : strings.settings.proOff}
              </Text>
            </View>
            {isPro ? null : (
              <Pressable
                onPress={() => setPaywallOpen(true)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowTitle}>
                  {strings.settings.proPurchase}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => void restore()}
              disabled={isBusy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowMuted}>{strings.settings.proRestore}</Text>
            </Pressable>
            {!paywallOpen && proError ? (
              <Text style={styles.error}>{proError}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.footer}>{runningBundleLabel()}</Text>

        {__DEV__ ? (
          <>
            <Pressable
              onPress={() => setDevOpen((v) => !v)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.devToggle, pressed && styles.pressed]}
            >
              <Text style={styles.rowMuted}>
                {strings.settings.devToggle}
                {devOpen ? ' ▾' : ' ▸'}
              </Text>
            </Pressable>
            {devOpen ? (
              <View style={styles.devBox}>
                <Text style={styles.devMono} numberOfLines={3}>
                  {diag}
                </Text>
                <Button
                  title={
                    dummyEnabled
                      ? strings.settings.devDummyDisable
                      : strings.settings.devDummyEnable
                  }
                  variant="ghost"
                  size="md"
                  onPress={() => setDummyEnabled(!dummyEnabled)}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {showProgress ? (
        <View
          style={[
            styles.progressDock,
            { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
          ]}
          accessibilityRole="progressbar"
          accessibilityLabel={progressLine(indexing)}
        >
          <Text style={styles.progressLine} numberOfLines={1}>
            {progressLine(indexing)}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.round(fill * 100)}%` }]}
            />
          </View>
        </View>
      ) : null}

      <Modal
        visible={albumSyncOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAlbumSyncOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setAlbumSyncOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {strings.settings.albumSyncModalTitle}
            </Text>
            <Text style={styles.modalBody}>
              {strings.settings.albumSyncModalBody}
            </Text>
            <Button
              title={strings.settings.albumSyncModalConfirm}
              variant="primary"
              size="md"
              onPress={confirmAlbumSync}
            />
            <Pressable
              onPress={() => setAlbumSyncOpen(false)}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.modalCancel}>
                {strings.settings.albumSyncModalCancel}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ProPaywallModal
        visible={paywallOpen}
        priceLabel={formatProPriceKrw()}
        isBusy={isBusy}
        error={proError}
        onClose={() => setPaywallOpen(false)}
        onPurchase={() => void purchase()}
        onRestore={() => void restore()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.md,
  },
  group: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
    color: theme.colors.subtle,
    marginBottom: theme.spacing.sm,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowTitle: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '500',
    flexShrink: 1,
  },
  rowValue: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowMuted: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
  },
  chevron: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '300',
    marginTop: -2,
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  chipOn: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.tint.faint,
  },
  chipText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  chipTextOn: {
    color: theme.colors.ink,
    fontWeight: '600',
  },
  error: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    marginTop: theme.spacing.xs,
  },
  footer: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    marginTop: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.5,
  },
  devToggle: {
    marginTop: theme.spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  devBox: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  devMono: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
  },
  progressDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  progressLine: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
    color: theme.colors.inkSoft,
  },
  progressTrack: {
    height: 2,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.ink,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  modalTitle: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  modalBody: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
  },
  modalCancel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    textAlign: 'center',
    paddingVertical: theme.spacing.xs,
  },
});
