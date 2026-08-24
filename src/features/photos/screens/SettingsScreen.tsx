import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter, type Href } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import {
  SettingsCustomRow,
  SettingsDivider,
  SettingsRow,
  SettingsSection,
} from '@/shared/components/SettingsList';
import { strings } from '@/shared/constants/strings';
import { formatProPriceKrw, IS_MONETIZATION_LIVE } from '@/shared/constants/pricing';
import { theme } from '@/shared/constants/theme';
import { useShellBackground } from '@/shared/hooks/useShellBackground';
import { useDarkMode, useTheme } from '@/shared/theme/ThemeProvider';
import {
  isStampLibrarySyncing,
  startStampLibrarySync,
  subscribeStampLibrarySync,
} from '@/features/stamps/services/stampLibrarySyncRunner';
import { useStampLibraryProgress } from '@/features/stamps/hooks/useStampLibraryProgress';
import { ProPaywallModal } from '@/features/insights/components/ProPaywallModal';
import { useIsPro } from '@/features/insights/hooks/useIsPro';

import { AlbumSyncModal } from '../components/AlbumSyncModal';
import {
  isLibrarySyncVisible,
  LibrarySyncDock,
} from '../components/LibrarySyncDock';
import { useCurrentMonth } from '../hooks/useCurrentMonth';
import { useMonthEndReminder } from '../hooks/useMonthEndReminder';
import { useMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import { useDevDummyPhotos } from '../hooks/useDevDummyPhotos';
import { useHiddenPhotos } from '../hooks/useHiddenPhotos';
import { useHomeLocation } from '../hooks/useHomeLocation';
import { photosQueryKeys } from '../hooks/photosQueryKeys';
import { DEFAULT_HOME_RADIUS_M } from '../services/homeLocationStorage';
import {
  getMonthEndReminderPermission,
  sendTestNotification,
} from '../services/monthEndReminder';
import { diagLine } from '../utils/settingsDiagnostics';

const RADIUS_CHOICES = [100, 300, 500, 1000] as const;
const EASTER_TAPS = 5;
const EASTER_WINDOW_MS = 2000;

function radiusLabel(radiusM: number): string {
  return radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`;
}

export function SettingsScreen() {
  const router = useRouter();
  const shellBg = useShellBackground();
  const { colors } = useTheme();
  const { enabled: darkMode, setEnabled: setDarkMode } = useDarkMode();
  const { enabled: monthEndReminder, setEnabled: setMonthEndReminder } =
    useMonthEndReminder();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { home, setHome, clearHome } = useHomeLocation();
  const { month } = useCurrentMonth();
  const { hidden } = useHiddenPhotos(month);
  const monthQuery = useMonthlyPhotos(month);
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
  const [easterOpen, setEasterOpen] = useState(false);
  const [easterBusy, setEasterBusy] = useState(false);
  const [easterError, setEasterError] = useState<string | null>(null);
  const easterTaps = useRef({ count: 0, firstAt: 0 });

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
  const showProgress = isLibrarySyncVisible(indexing, albumSyncing);

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
    void startStampLibrarySync({ incremental: true });
  };

  const onTitlePress = useCallback(() => {
    const now = performance.now();
    const prev = easterTaps.current;
    if (now - prev.firstAt > EASTER_WINDOW_MS) {
      easterTaps.current = { count: 1, firstAt: now };
      return;
    }
    const count = prev.count + 1;
    if (count >= EASTER_TAPS) {
      easterTaps.current = { count: 0, firstAt: 0 };
      setEasterOpen(true);
      return;
    }
    easterTaps.current = { count, firstAt: prev.firstAt };
  }, []);

  const sendEasterNotification = useCallback(async () => {
    setEasterError(null);
    setEasterBusy(true);
    try {
      const ok = await sendTestNotification();
      if (ok) {
        return;
      }
      const permission = await getMonthEndReminderPermission();
      setEasterError(
        permission === 'denied'
          ? strings.settings.sendTestNotificationDenied
          : strings.settings.sendTestNotificationFailed,
      );
    } finally {
      setEasterBusy(false);
    }
  }, []);

  // `shellInk` is near-white in dark mode, which erases the light thumb —
  // the on-state fill needs its own token. See theme.colors.shellSwitchOn.
  const switchTrack = { false: colors.border, true: colors.shellSwitchOn };

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
      <ScreenHeader
        title={strings.settings.title}
        onTitlePress={onTitlePress}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          (showProgress || easterOpen) && { paddingBottom: 96 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Every reason a photo is missing from the map, in one card. */}
        <SettingsSection label={strings.settings.mapNoticeSection}>
          <SettingsRow
            title={strings.settings.noLocationTitle}
            subtitle={strings.settings.noLocationExplain}
            value={strings.settings.noLocationCount(
              monthQuery.data?.noLocationCount ?? 0,
            )}
            onPress={() => router.push('/no-location-photos' as Href)}
          />
          <SettingsDivider />
          <SettingsRow
            title={strings.settings.hiddenPhotos}
            subtitle={strings.settings.hiddenPhotosExplain}
            value={strings.settings.hiddenPhotosCount(hidden.size)}
            onPress={() => router.push('/hidden-photos' as Href)}
          />
        </SettingsSection>

        <SettingsSection label={strings.settings.homeSection}>
          <SettingsRow
            title={
              isLocating
                ? strings.settings.locating
                : strings.settings.useCurrentLocation
            }
            subtitle={strings.settings.homeExcludedExplain}
            value={
              home ? strings.settings.homeSet(home.radiusM) : strings.settings.homeUnset
            }
            disabled={isLocating}
            onPress={() => void captureCurrentLocation()}
          />
          {home ? (
            <>
              <SettingsDivider />
              <SettingsCustomRow>
                <Text style={[styles.radiusLabel, { color: colors.shellInk }]}>
                  {strings.settings.homeRadius}
                </Text>
                <View style={styles.chips}>
                  {RADIUS_CHOICES.map((choice) => {
                    const active = choice === home.radiusM;
                    return (
                      <Pressable
                        key={choice}
                        onPress={() => setHome({ ...home, radiusM: choice })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.chip,
                          { borderColor: colors.border },
                          active && {
                            backgroundColor: colors.shellInk,
                            borderColor: colors.shellInk,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: active
                                ? colors.shellSurface
                                : colors.shellInkSoft,
                            },
                            active && styles.chipTextOn,
                          ]}
                        >
                          {radiusLabel(choice)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </SettingsCustomRow>
              <SettingsDivider />
              <SettingsRow
                title={strings.settings.clearHome}
                muted
                chevron={false}
                onPress={clearHome}
              />
            </>
          ) : null}
        </SettingsSection>
        {error ? (
          <Text style={[styles.error, { color: colors.shellInk }]}>{error}</Text>
        ) : null}

        <SettingsSection label={strings.settings.albumSection}>
          <SettingsRow
            title={
              albumSyncing
                ? strings.settings.albumSyncing
                : strings.settings.albumSync
            }
            subtitle={strings.settings.albumSyncExplain}
            disabled={albumSyncing}
            onPress={() => setAlbumSyncOpen(true)}
          />
        </SettingsSection>

        <SettingsSection label={strings.settings.notificationSection}>
          <SettingsRow
            title={strings.settings.monthEndReminder}
            subtitle={strings.settings.monthEndReminderHint}
            trailing={
              <Switch
                value={monthEndReminder}
                onValueChange={setMonthEndReminder}
                trackColor={switchTrack}
                thumbColor={theme.colors.surface}
                ios_backgroundColor={colors.border}
                accessibilityLabel={strings.settings.monthEndReminder}
              />
            }
          />
        </SettingsSection>

        <SettingsSection label={strings.settings.displaySection}>
          <SettingsRow
            title={strings.settings.darkMode}
            trailing={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={switchTrack}
                thumbColor={theme.colors.surface}
                ios_backgroundColor={colors.border}
                accessibilityLabel={strings.settings.darkMode}
              />
            }
          />
        </SettingsSection>

        {IS_MONETIZATION_LIVE ? (
          <SettingsSection label={strings.settings.proSection}>
            <SettingsRow
              title={strings.settings.proSection}
              value={isPro ? strings.settings.proOn : strings.settings.proOff}
            />
            {isPro ? null : (
              <>
                <SettingsDivider />
                <SettingsRow
                  title={strings.settings.proPurchase}
                  onPress={() => setPaywallOpen(true)}
                />
              </>
            )}
            <SettingsDivider />
            <SettingsRow
              title={strings.settings.proRestore}
              muted
              chevron={false}
              disabled={isBusy}
              onPress={() => void restore()}
            />
          </SettingsSection>
        ) : null}
        {IS_MONETIZATION_LIVE && !paywallOpen && proError ? (
          <Text style={[styles.error, { color: colors.shellInk }]}>{proError}</Text>
        ) : null}

        {__DEV__ ? (
          <View style={styles.devWrap}>
            <Pressable
              onPress={() => setDevOpen((v) => !v)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.devToggle, pressed && styles.pressed]}
            >
              <Text style={[styles.devLabel, { color: colors.shellSubtle }]}>
                {strings.settings.devToggle}
                {devOpen ? ' ▾' : ' ▸'}
              </Text>
            </Pressable>
            {devOpen ? (
              <View
                style={[
                  styles.devBox,
                  {
                    backgroundColor: colors.shellSurface,
                    borderColor: colors.hairline,
                  },
                ]}
              >
                <Text
                  style={[styles.devMono, { color: colors.shellSubtle }]}
                  numberOfLines={3}
                >
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
          </View>
        ) : null}
      </ScrollView>

      <LibrarySyncDock progress={indexing} syncing={albumSyncing} />

      {easterOpen ? (
        <View
          style={[
            styles.easterBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.hairline,
              paddingBottom: Math.max(insets.bottom, theme.spacing.md),
            },
          ]}
        >
          {easterError ? (
            <Text style={[styles.easterError, { color: colors.shellInk }]}>
              {easterError}
            </Text>
          ) : null}
          <Button
            title={strings.settings.sendTestNotification}
            loading={easterBusy}
            onPress={() => void sendEasterNotification()}
          />
        </View>
      ) : null}

      <AlbumSyncModal
        visible={albumSyncOpen}
        onCancel={() => setAlbumSyncOpen(false)}
        onConfirm={confirmAlbumSync}
      />

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
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  radiusLabel: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  chipText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
  },
  chipTextOn: {
    fontWeight: '700',
  },
  error: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    marginLeft: theme.spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
  devWrap: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  devToggle: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  devLabel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
  },
  devBox: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  devMono: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
  },
  easterBar: {
    zIndex: 2,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  easterError: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
  },
});
