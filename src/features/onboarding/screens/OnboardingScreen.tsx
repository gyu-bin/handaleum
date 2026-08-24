import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';
import { requestMonthEndReminderPermission } from '@/features/photos/services/monthEndReminder';
import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';

import { PaperPanelArt } from '../components/PaperPanelArt';
import { useOnboarding } from '../hooks/useOnboarding';

/**
 * First-run — headline + paper map sheet + one button.
 *
 * There is no import toggle: the system photo dialog already asks for full vs
 * limited access, so asking first in our own UI only added a tap.
 */
export function OnboardingScreen() {
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const router = useRouter();
  const params = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === '1';
  const { markSeen } = useOnboarding();
  const { request } = usePhotoPermission();
  const [busy, setBusy] = useState(false);

  const leaveReplay = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  const onStart = async () => {
    if (isReplay) {
      leaveReplay();
      return;
    }
    setBusy(true);
    markSeen();
    const next = await request();
    const granted = next === 'granted' || next === 'limited';
    await requestMonthEndReminderPermission();
    router.replace(granted ? '/' : '/permission');
  };

  return (
    <SafeAreaView
      style={[styles.safe, shellBg]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      {isReplay ? (
        <View style={styles.topRow}>
          <Pressable
            onPress={leaveReplay}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[styles.skipText, shell.soft]}>
              {strings.onboarding.close}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.topPad} />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <Text style={[styles.brand, shell.subtle]}>{strings.brand}</Text>

          <View style={styles.panelSlot}>
            <PaperPanelArt />
          </View>

          <Text style={styles.headline}>
            <Text style={[styles.headlineLead, shell.soft]}>
              {strings.onboarding.headlineLead}
            </Text>
            {'\n'}
            <Text style={[styles.headlineKey, shell.ink]}>
              {strings.onboarding.headlineKey}
            </Text>
          </Text>
          <Text style={[styles.subhead, shell.soft]}>
            {strings.onboarding.subhead}
          </Text>
        </View>

        <View style={styles.footer}>
          {!isReplay ? (
            <Text style={[styles.privacy, shell.subtle]}>
              {strings.onboarding.privacy}
            </Text>
          ) : null}
          <Button
            title={isReplay ? strings.onboarding.close : strings.onboarding.start}
            variant="primary"
            loading={busy}
            onPress={() => void onStart()}
            style={styles.startBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topRow: {
    height: 40,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  topPad: {
    height: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.5,
  },
  skipText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  /** Fill tall phones; scroll on short ones without shrinking type or the map slot. */
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  brand: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: theme.spacing.md,
  },
  panelSlot: {
    flex: 1,
    width: '100%',
    minHeight: 260,
    marginBottom: theme.spacing.lg,
  },
  headline: {
    ...theme.type.lede,
    fontFamily: theme.fonts.sans,
  },
  /** Light lead line — the setup. */
  headlineLead: {
    ...theme.type.lede,
    fontFamily: theme.fonts.sans,
    fontWeight: '300',
  },
  /** Bold key line — the payoff. */
  headlineKey: {
    ...theme.type.lede,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
  },
  subhead: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    marginTop: theme.spacing.sm,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  privacy: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    letterSpacing: -0.1,
    marginBottom: theme.spacing.md,
  },
  startBtn: {
    alignSelf: 'stretch',
  },
});
