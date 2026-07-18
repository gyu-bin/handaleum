import { useEffect } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { usePhotoPermission } from '../hooks/usePhotoPermission';

export function PermissionScreen() {
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>🗺️</Text>
          </View>
          <Text style={styles.title}>{strings.permission.title}</Text>
          <Text style={styles.bodyText}>
            {isDenied ? strings.permission.denied : strings.permission.description}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Button
          title={isDenied ? strings.common.confirm : strings.permission.request}
          variant="accent"
          onPress={() =>
            isDenied ? void Linking.openSettings() : void onRequest()
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.accentSoft,
    marginBottom: theme.spacing.sm,
  },
  icon: {
    fontSize: 44,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  bodyText: {
    color: theme.colors.inkSoft,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
});
