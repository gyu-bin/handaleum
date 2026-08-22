import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { getMonthEndReminderEnabled } from '@/lib/storage';

import {
  clearHandledMonthEndReminder,
  getMonthEndReminderPermission,
  isMonthEndReminderResponse,
  requestMonthEndReminderPermission,
  setMonthEndReminderOn,
  syncMonthEndReminder,
} from '../services/monthEndReminder';

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
      setEnabledState(granted);
      return;
    }
    await syncMonthEndReminder();
    const latest = await getMonthEndReminderPermission();
    setEnabledState(latest === 'granted' && getMonthEndReminderEnabled());
  }, []);

  useEffect(() => {
    void refresh(promptIfUndetermined);
  }, [promptIfUndetermined, refresh]);

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

/** Cold start / tap: open the home monthly map, then drop the response. */
export function useOpenHomeOnMonthEndReminder(): void {
  const router = useRouter();
  const last = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!isMonthEndReminderResponse(last)) {
      return;
    }
    router.replace('/');
    clearHandledMonthEndReminder();
  }, [last, router]);
}
