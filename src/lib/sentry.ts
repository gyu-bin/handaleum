import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

/**
 * Public DSN from env (EAS Secret / .env). No DSN → Sentry stays off;
 * ErrorBoundary still catches render crashes locally.
 */
function resolveDsn(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const extra = Constants.expoConfig?.extra as { sentryDsn?: string } | undefined;
  const fromExtra = extra?.sentryDsn?.trim();
  return fromExtra || undefined;
}

let initialized = false;

/** Call once at app entry, before the root tree mounts. */
export function initSentry(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = resolveDsn();
  if (!dsn) {
    if (__DEV__) {
      console.info(
        '[sentry] EXPO_PUBLIC_SENTRY_DSN unset — crash reporting disabled',
      );
    }
    return;
  }

  const inExpoGo = isRunningInExpoGo();

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Photo/location app — keep payloads minimal.
    sendDefaultPii: false,
    // Light tracing in production; off in dev noise.
    tracesSampleRate: __DEV__ ? 0 : 0.15,
    enableNativeFramesTracking: !inExpoGo,
    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],
  });
}

export function captureRenderError(error: unknown, componentStack?: string | null): void {
  const dsn = resolveDsn();
  if (!dsn) {
    return;
  }
  Sentry.captureException(error, {
    contexts: componentStack
      ? { react: { componentStack } }
      : undefined,
  });
}

export { Sentry };
