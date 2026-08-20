import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';
import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { PaperPanelArt } from '../components/PaperPanelArt';
import { useOnboarding } from '../hooks/useOnboarding';

/**
 * First-run B — headline + paper map panel (photo pins) + album toggle + start.
 */
export function OnboardingScreen() {
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === '1';
  const { markSeen } = useOnboarding();
  const { request } = usePhotoPermission();
  const [busy, setBusy] = useState(false);
  const [importPhotos, setImportPhotos] = useState(true);

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
    if (!importPhotos) {
      router.replace('/permission');
      return;
    }
    const next = await request();
    const granted = next === 'granted' || next === 'limited';
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
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={[styles.brand, shell.subtle]}>{strings.brand}</Text>
        <Text style={[styles.headline, shell.ink]}>
          {strings.onboarding.headline}
        </Text>
        <Text style={[styles.subhead, shell.soft]}>
          {strings.onboarding.subhead}
        </Text>

        <View style={styles.panelSlot}>
          <PaperPanelArt />
        </View>

        {!isReplay ? (
          <View
            style={[
              styles.toggleBlock,
              { borderTopColor: colors.hairline },
            ]}
          >
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, shell.ink]}>
                {strings.onboarding.photoToggle}
              </Text>
              <Switch
                value={importPhotos}
                onValueChange={setImportPhotos}
                trackColor={{
                  false: colors.line,
                  true: colors.shellInk,
                }}
                thumbColor={theme.colors.surface}
              />
            </View>
            <Text style={[styles.toggleHint, shell.subtle]}>
              {strings.onboarding.photoToggleHint}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={
            isReplay ? strings.onboarding.close : strings.onboarding.start
          }
          variant="primary"
          loading={busy}
          onPress={() => void onStart()}
          style={styles.startBtn}
        />
      </View>
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
    height: theme.spacing.md,
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
  body: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
  },
  brand: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  headline: {
    fontSize: 26,
    lineHeight: 36,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.7,
  },
  subhead: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  panelSlot: {
    width: '100%',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  toggleBlock: {
    width: '100%',
    marginTop: 'auto',
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  toggleLabel: {
    ...theme.type.label,
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
  },
  toggleHint: {
    ...theme.type.micro,
    width: '100%',
    fontFamily: theme.fonts.sans,
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  startBtn: {
    alignSelf: 'stretch',
  },
});
