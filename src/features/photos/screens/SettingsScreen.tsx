import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { PaperGrain } from '@/shared/components/PaperGrain';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { strings } from '@/shared/constants/strings';
import { formatProPriceKrw, IS_MONETIZATION_LIVE } from '@/shared/constants/pricing';
import { theme } from '@/shared/constants/theme';

import { getStampScanDebug } from '@/features/stamps/services/stampBackfill';

import { useHomeLocation } from '../hooks/useHomeLocation';
import { useDevDummyPhotos } from '../hooks/useDevDummyPhotos';
import { geocodeQueueDebug } from '../services/geocodeQueue';
import { getVisitResolveDebug } from '../services/placeResolve';
import { DEFAULT_HOME_RADIUS_M } from '../services/homeLocationStorage';
import { dummyPhotoCount } from '../services/dummyPhotos';
import { ProPaywallModal } from '@/features/insights/components/ProPaywallModal';
import { useIsPro } from '@/features/insights/hooks/useIsPro';

const RADIUS_CHOICES = [100, 300, 500, 1000] as const;

function radiusLabel(radiusM: number): string {
  return radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`;
}

/** Live geocode/scan counters — settles "is it still loading or broken?" on device. */
function diagLines(): string[] {
  const q = geocodeQueueDebug();
  const lines = [
    strings.settings.diag.queue(q.interactive, q.background, q.backoffMs, q.done, q.failed),
  ];

  const month = getVisitResolveDebug();
  if (!month) {
    lines.push(strings.settings.diag.monthIdle);
  } else {
    lines.push(
      strings.settings.diag.month(
        month.resolvedBuckets,
        month.cachedBuckets,
        month.totalBuckets,
        month.failedBuckets,
        month.finished,
      ),
    );
    lines.push(month.labels.join(' · '));
  }

  const scan = getStampScanDebug();
  const elapsedSec =
    scan.startedAt > 0 ? Math.round((Date.now() - scan.startedAt) / 1000) : 0;
  if (scan.phase === 'idle') {
    lines.push(strings.settings.diag.scanIdle);
  } else if (scan.phase === 'gps') {
    lines.push(strings.settings.diag.scanGps(elapsedSec));
  } else if (scan.phase === 'geocode') {
    lines.push(
      strings.settings.diag.scanGeocode(scan.chunkDone, scan.chunkTotal, elapsedSec),
    );
  } else {
    lines.push(strings.settings.diag.scanDone);
  }
  return lines;
}

/** Which JS bundle is actually running — settles "did the OTA apply?" on device. */
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
  const router = useRouter();
  const { home, setHome, clearHome } = useHomeLocation();
  const { isPro, isBusy, error: proError, purchase, restore } = useIsPro();
  const { enabled: dummyEnabled, setEnabled: setDummyEnabled } = useDevDummyPhotos();
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [diag, setDiag] = useState<string[]>(() => diagLines());

  // 1s poll only while this screen is mounted — cheap reads of module counters.
  useEffect(() => {
    const timer = setInterval(() => setDiag(diagLines()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isPro) {
      setPaywallOpen(false);
    }
  }, [isPro]);

  const radius = home?.radiusM ?? DEFAULT_HOME_RADIUS_M;

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

  const pickRadius = (radiusM: number) => {
    if (!home) {
      return;
    }
    setHome({ ...home, radiusM });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PaperGrain style={styles.grain} />
      <ScreenHeader title={strings.settings.title} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{strings.settings.homeSection}</Text>
          <Text style={styles.description}>{strings.settings.homeDescription}</Text>

          <Text style={[styles.status, home && styles.statusSet]}>
            {home
              ? strings.settings.homeSet(home.radiusM)
              : strings.settings.homeUnset}
          </Text>

          <Button
            title={
              isLocating
                ? strings.settings.locating
                : strings.settings.useCurrentLocation
            }
            variant="accent"
            size="md"
            loading={isLocating}
            onPress={() => void captureCurrentLocation()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {home ? (
            <View style={styles.radiusBlock}>
              <Text style={styles.radiusLabel}>{strings.settings.radiusLabel}</Text>
              <View style={styles.radiusRow}>
                {RADIUS_CHOICES.map((choice) => {
                  const active = choice === home.radiusM;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => pickRadius(choice)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.radiusChip,
                        active && styles.radiusChipActive,
                        pressed && styles.radiusChipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.radiusChipText,
                          active && styles.radiusChipTextActive,
                        ]}
                      >
                        {radiusLabel(choice)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>{strings.settings.radiusHint}</Text>

              <Button
                title={strings.settings.clearHome}
                variant="ghost"
                size="md"
                onPress={clearHome}
              />
            </View>
          ) : null}
        </View>

        {IS_MONETIZATION_LIVE ? (
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.sectionTitle}>{strings.settings.proSection}</Text>
            <Text style={styles.description}>
              {strings.settings.proDescription(formatProPriceKrw())}
            </Text>
            <Text style={[styles.status, isPro && styles.statusSet]}>
              {isPro ? strings.settings.proOn : strings.settings.proOff}
            </Text>
            {isPro ? null : (
              <Button
                title={strings.settings.proPurchase}
                variant="accent"
                size="md"
                onPress={() => setPaywallOpen(true)}
              />
            )}
            <Button
              title={strings.settings.proRestore}
              variant="ghost"
              size="md"
              loading={isBusy}
              disabled={isBusy}
              onPress={() => void restore()}
            />
            {!paywallOpen && proError ? (
              <Text style={styles.error}>{proError}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.card, styles.cardSpaced]}>
          <Button
            title={strings.settings.viewOnboarding}
            variant="secondary"
            size="md"
            onPress={() => router.push('/onboarding?replay=1')}
          />
        </View>

        <View style={[styles.card, styles.cardSpaced]}>
          <Text style={styles.sectionTitle}>{strings.settings.buildSection}</Text>
          <Text style={styles.status}>{runningBundleLabel()}</Text>
        </View>

        <View style={[styles.card, styles.cardSpaced]}>
          <Text style={styles.sectionTitle}>{strings.settings.diag.section}</Text>
          {diag.map((line, i) => (
            <Text key={i} style={styles.hint}>
              {line}
            </Text>
          ))}
        </View>

        {__DEV__ ? (
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.sectionTitle}>{strings.settings.devDummySection}</Text>
            <Text style={styles.description}>
              {strings.settings.devDummyDescription(dummyPhotoCount())}
            </Text>
            <Text style={[styles.status, dummyEnabled && styles.statusSet]}>
              {dummyEnabled
                ? strings.settings.devDummyOn
                : strings.settings.devDummyOff}
            </Text>
            <Button
              title={
                dummyEnabled
                  ? strings.settings.devDummyDisable
                  : strings.settings.devDummyEnable
              }
              variant={dummyEnabled ? 'secondary' : 'primary'}
              size="md"
              onPress={() => setDummyEnabled(!dummyEnabled)}
            />
          </View>
        ) : null}
      </ScrollView>

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
  grain: {
    opacity: 0.28,
  },
  content: {
    padding: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
  },
  cardSpaced: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  description: {
    ...theme.type.label,
    fontFamily: theme.fonts.serif,
    color: theme.colors.inkSoft,
  },
  status: {
    ...theme.type.label,
    fontFamily: theme.fonts.serif,
    fontWeight: '600',
    color: theme.colors.subtle,
    paddingVertical: theme.spacing.xs,
  },
  statusSet: {
    color: theme.colors.terracotta,
  },
  error: {
    ...theme.type.micro,
    color: theme.colors.ink,
  },
  radiusBlock: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  radiusLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.serif,
    fontWeight: '600',
    color: theme.colors.subtle,
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  radiusChipActive: {
    backgroundColor: theme.colors.terracottaSoft,
    borderColor: theme.colors.terracotta,
  },
  radiusChipPressed: {
    opacity: 0.7,
  },
  radiusChipText: {
    ...theme.type.label,
    fontFamily: theme.fonts.serif,
    fontWeight: '600',
    color: theme.colors.inkSoft,
  },
  radiusChipTextActive: {
    color: theme.colors.terracotta,
  },
  hint: {
    ...theme.type.micro,
    fontFamily: theme.fonts.serif,
    color: theme.colors.subtle,
  },
});
