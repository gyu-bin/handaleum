import { useEffect } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { PaperGrain } from '@/shared/components/PaperGrain';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellBackground, useShellInk } from '@/shared/hooks/useShellBackground';

import { usePhotoPermission } from '../hooks/usePhotoPermission';

export function PermissionScreen() {
  const shellBg = useShellBackground();
  const shell = useShellInk();
  const router = useRouter();
  const { status, isReady, request } = usePhotoPermission();

  // Already granted (e.g. navigated here manually): go straight home.
  useEffect(() => {
    if (isReady && (status === 'granted' || status === 'limited')) {
      router.replace('/');
    }
  }, [isReady, status, router]);

  const onRequest = async () => {
    const next = await request();
    if (next === 'granted' || next === 'limited') {
      router.replace('/');
    }
  };

  const isDenied = status === 'denied';

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'bottom', 'left', 'right']}>
      <PaperGrain style={styles.grain} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <Text style={styles.icon}>🗺️</Text>
            </View>
            <Text style={[styles.title, shell.ink]}>{strings.permission.title}</Text>
            <Text style={[styles.bodyText, shell.soft]}>
              {isDenied ? strings.permission.denied : strings.permission.description}
            </Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Button
            title={
              isDenied ? strings.permission.openSettings : strings.permission.request
            }
            variant="accent"
            style={styles.cta}
            onPress={() =>
              isDenied ? void Linking.openSettings() : void onRequest()
            }
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
  grain: {
    opacity: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },

  hero: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.terracottaSoft,
    marginBottom: theme.spacing.sm,
  },
  icon: {
    fontSize: 44,
  },
  /**
   * `title`, not `display` — the display step is tuned for short strings like
   * a month name. A full Korean sentence at that size fills the line box edge
   * to edge and orphans its last syllable.
   */
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyText: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },

  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  cta: {
    alignSelf: 'stretch',
  },
});
