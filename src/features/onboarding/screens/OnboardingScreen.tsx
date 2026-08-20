import { useCallback, useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import koreaGeo from '@/assets/geo/korea.json';
import {
  bboxOf,
  createProjection,
  geometryToPath,
  type PackedGeometry,
} from '@/features/photos/utils/geo';
import { usePhotoPermission } from '@/features/photos/hooks/usePhotoPermission';
import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { useOnboarding } from '../hooks/useOnboarding';

function KoreaSilhouette() {
  const { colors } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const southKorea = koreaGeo.korea as unknown as PackedGeometry;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.width) < 1 && Math.abs(height - size.height) < 1) {
      return;
    }
    setSize({ width, height });
  };

  const path = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) {
      return '';
    }
    const projection = createProjection(
      bboxOf(southKorea),
      size.width,
      size.height,
      10,
    );
    return geometryToPath(southKorea, projection.project);
  }, [size.height, size.width, southKorea]);

  return (
    <View style={styles.mapWrap} onLayout={onLayout}>
      {path ? (
        <Svg width={size.width} height={size.height}>
          <Path
            d={path}
            fill={colors.shellInk}
            fillOpacity={0.92}
          />
        </Svg>
      ) : null}
    </View>
  );
}

/** Minimal first-run — brand, line, peninsula, photo toggle, start. */
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
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'bottom', 'left', 'right']}>
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

      <View style={styles.body}>
        <Text style={[styles.brand, shell.subtle]}>{strings.brand}</Text>
        <Text style={[styles.headline, shell.ink]}>
          {strings.onboarding.headline}
        </Text>
        <Text style={[styles.subhead, shell.soft]}>
          {strings.onboarding.subhead}
        </Text>

        <KoreaSilhouette />

        {!isReplay ? (
          <>
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
          </>
        ) : null}
      </View>

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
    height: theme.spacing.lg,
  },
  pressed: {
    opacity: 0.5,
  },
  skipText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  brand: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: theme.spacing.md,
  },
  headline: {
    fontSize: 24,
    lineHeight: 32,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  subhead: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  mapWrap: {
    width: '70%',
    aspectRatio: 0.72,
    maxHeight: 280,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  toggleLabel: {
    ...theme.type.label,
    flex: 1,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '500',
  },
  toggleHint: {
    ...theme.type.micro,
    width: '100%',
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  startBtn: {
    alignSelf: 'stretch',
  },
});
