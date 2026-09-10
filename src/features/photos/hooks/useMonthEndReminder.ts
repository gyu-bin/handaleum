import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { useIsPro } from '@/features/insights/hooks/useIsPro';
import { getMonthEndReminderEnabled } from '@/lib/storage';

import {
  clearHandledMemoryReminder,
  isMemoryReminderResponse,
  memoryMonthFromResponse,
  syncMemoryReminder,
} from '../services/memoryReminder';
import {
  clearHandledMonthEndReminder,
  getMonthEndReminderPermission,
  isMonthEndReminderResponse,
  requestMonthEndReminderPermission,
  setMonthEndReminderOn,
  syncMonthEndReminder,
} from '../services/monthEndReminder';
import { canAccessMonth } from '../utils/monthAccess';
import { applyViewedMonth } from './useCurrentMonth';

/**
 * Prompt once when OS permission is still undetermined (existing installs),
 * then keep the next month-end local notification in sync.
 */
export function useMonthEndReminder(options?: {
  promptIfUndetermined?: boolean;
}): {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
} {
  const promptIfUndetermined = options?.promptIfUndetermined === true;
  const [enabled, setEnabledState] = useState(false);

  const refresh = useCallback(async (mayPrompt: boolean) => {
    const permission = await getMonthEndReminderPermission();
    if (mayPrompt && permission === 'undetermined') {
      const granted = await requestMonthEndReminderPermission();
      if (granted) {
        await syncMemoryReminder();
      }
      setEnabledState(granted);
      return;
    }
    await syncMonthEndReminder();
    await syncMemoryReminder();
    const latest = await getMonthEndReminderPermission();
    setEnabledState(latest === 'granted' && getMonthEndReminderEnabled());
  }, []);

  useEffect(() => {
    void refresh(promptIfUndetermined);
  }, [promptIfUndetermined, refresh]);

  useEffect(() => {
    if (!__DEV__ || process.env.EXPO_PUBLIC_TEST_MEMORY !== '1') {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const { sendTestMemoryNotification } = await import(
          '../services/memoryReminder'
        );
        if (cancelled) {
          return;
        }
        await sendTestMemoryNotification();
      })();
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh(false);
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const setEnabled = useCallback(
    (on: boolean) => {
      void (async () => {
        if (on) {
          const permission = await getMonthEndReminderPermission();
          if (permission === 'denied') {
            await Linking.openSettings();
            return;
          }
        }
        const next = await setMonthEndReminderOn(on);
        setEnabledState(next);
      })();
    },
    [],
  );

  return { enabled, setEnabled };
}

/**
 * Cold start / tap: open home. Memory reminders also jump to the content month.
 */
export function useOpenHomeOnMonthEndReminder(): void {
  const router = useRouter();
  const { isPro } = useIsPro();
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (isMemoryReminderResponse(last)) {
      const month = memoryMonthFromResponse(last);
      if (month && canAccessMonth(month, isPro)) {
        applyViewedMonth(month);
      }
      router.replace('/');
      clearHandledMemoryReminder();
      return;
    }
    if (!isMonthEndReminderResponse(last)) {
      return;
    }
    router.replace('/');
    clearHandledMonthEndReminder();
  }, [isPro, last, router]);
}
