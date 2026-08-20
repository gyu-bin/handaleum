import { useCallback, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  applyOtaUpdateIfAvailable,
  startOtaAutoApply,
} from '@/lib/applyOtaUpdate';
import { configurePurchases } from '@/lib/purchases';
import { consumeOtaJustApplied } from '@/lib/otaUpdateFlag';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { OtaToast } from '@/shared/components/OtaToast';
import { strings } from '@/shared/constants/strings';
import { ThemeProvider, useDarkMode, useTheme } from '@/shared/theme/ThemeProvider';

configurePurchases();

void SplashScreen.preventAutoHideAsync();

/** First-run gates — bottom CTA must not sit under the OTA pill. */
function hidesOtaToast(pathname: string): boolean {
  return (
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname === '/permission' ||
    pathname.startsWith('/permission/')
  );
}

function AppNavigation() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const { enabled: dark } = useDarkMode();
  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </GestureHandlerRootView>
  );
}

function OtaToasts({
  progressMessage,
  progressPersistent,
  doneVisible,
  onDoneHidden,
}: {
  progressMessage: string | null;
  progressPersistent: boolean;
  doneVisible: boolean;
  onDoneHidden: () => void;
}) {
  const pathname = usePathname();
  const quiet = hidesOtaToast(pathname);

  return (
    <>
      <OtaToast
        visible={!quiet && progressMessage != null}
        message={progressMessage ?? ''}
        persistent={progressPersistent}
      />
      <OtaToast
        visible={!quiet && doneVisible}
        message={strings.ota.done}
        onHidden={onDoneHidden}
      />
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [otaToastMessage, setOtaToastMessage] = useState<string | null>(null);
  const [otaToastPersistent, setOtaToastPersistent] = useState(false);
  const [otaDoneToast, setOtaDoneToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stopPoll: (() => void) | undefined;

    void (async () => {
      // Cold start: stay on native splash, apply OTA silently (no toast / old UI).
      const cold = await applyOtaUpdateIfAvailable();
      if (cancelled) {
        return;
      }
      if (cold.kind === 'reloading') {
        // Process restarts — keep splash up until then.
        return;
      }

      await SplashScreen.hideAsync().catch(() => {});
      if (cancelled) {
        return;
      }

      if (consumeOtaJustApplied()) {
        setOtaDoneToast(true);
      }
      setReady(true);

      // Later checks (foreground / poll) may show the toast.
      stopPoll = startOtaAutoApply({
        skipInitial: true,
        onProgress: (phase) => {
          setOtaToastPersistent(true);
          setOtaToastMessage(
            phase === 'updating' ? strings.ota.updating : strings.ota.checking,
          );
        },
        onSettled: (result) => {
          if (result.kind === 'reloading') {
            return;
          }
          setOtaToastMessage(null);
          setOtaToastPersistent(false);
        },
      });
    })();

    return () => {
      cancelled = true;
      stopPoll?.();
    };
  }, []);

  const hideOtaDoneToast = useCallback(() => setOtaDoneToast(false), []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootShell>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              {ready ? (
                <>
                  <AppNavigation />
                  <OtaToasts
                    progressMessage={otaToastMessage}
                    progressPersistent={otaToastPersistent}
                    doneVisible={otaDoneToast}
                    onDoneHidden={hideOtaDoneToast}
                  />
                </>
              ) : null}
            </QueryClientProvider>
          </ErrorBoundary>
        </RootShell>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
