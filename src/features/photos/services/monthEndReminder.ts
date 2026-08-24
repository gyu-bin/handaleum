import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  getMonthEndReminderEnabled,
  setMonthEndReminderEnabled,
} from '@/lib/storage';
import { strings } from '@/shared/constants/strings';

import { nextMonthEndAt } from '../utils/monthEndAt';

export const MONTH_END_REMINDER_ID = 'month-end-reminder';
export const MONTH_END_REMINDER_KIND = 'month-end';
const TEST_NOTIFICATION_ID = 'month-end-test';

const CHANNEL_ID = 'month-end';

let handlerReady = false;

export function configureMonthEndReminder(): void {
  if (handlerReady) {
    return;
  }
  handlerReady = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.error('configureMonthEndReminder failed', error);
  }
}

function isGranted(
  status: Notifications.NotificationPermissionsStatus,
): boolean {
  if (status.granted) {
    return true;
  }
  return (
    status.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export type MonthEndReminderPermission = 'undetermined' | 'granted' | 'denied';

export async function getMonthEndReminderPermission(): Promise<MonthEndReminderPermission> {
  try {
    const status = await Notifications.getPermissionsAsync();
    if (isGranted(status)) {
      return 'granted';
    }
    if (status.status === 'denied') {
      return 'denied';
    }
    if (
      status.ios?.status === Notifications.IosAuthorizationStatus.DENIED
    ) {
      return 'denied';
    }
    return 'undetermined';
  } catch (error) {
    console.error('getMonthEndReminderPermission failed', error);
    return 'denied';
  }
}

export async function cancelMonthEndReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(MONTH_END_REMINDER_ID);
  } catch (error) {
    console.error('cancelMonthEndReminder failed', error);
  }
}

export async function syncMonthEndReminder(now = new Date()): Promise<void> {
  try {
    if (!getMonthEndReminderEnabled()) {
      await cancelMonthEndReminder();
      return;
    }
    const permission = await getMonthEndReminderPermission();
    if (permission !== 'granted') {
      await cancelMonthEndReminder();
      return;
    }
    await ensureAndroidChannel();
    const fire = nextMonthEndAt(now);
    await Notifications.cancelScheduledNotificationAsync(MONTH_END_REMINDER_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: MONTH_END_REMINDER_ID,
      content: {
        title: strings.monthEndReminder.title(fire.getMonth() + 1),
        body: strings.monthEndReminder.body,
        sound: true,
        data: { kind: MONTH_END_REMINDER_KIND },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire,
        channelId: CHANNEL_ID,
      },
    });
  } catch (error) {
    console.error('syncMonthEndReminder failed', error);
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (isGranted(existing)) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return isGranted(asked);
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: strings.settings.monthEndReminder,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Foreground banner now. Does not enable or reschedule the month-end reminder. */
export async function sendTestNotification(now = new Date()): Promise<boolean> {
  configureMonthEndReminder();
  try {
    const ok = await ensureNotificationPermission();
    if (!ok) {
      return false;
    }
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: TEST_NOTIFICATION_ID,
      content: {
        title: strings.monthEndReminder.title(now.getMonth() + 1),
        body: strings.monthEndReminder.body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    console.error('sendTestNotification failed', error);
    return false;
  }
}

export async function requestMonthEndReminderPermission(): Promise<boolean> {
  try {
    const ok = await ensureNotificationPermission();
    setMonthEndReminderEnabled(ok);
    if (ok) {
      await syncMonthEndReminder();
    } else {
      await cancelMonthEndReminder();
    }
    return ok;
  } catch (error) {
    console.error('requestMonthEndReminderPermission failed', error);
    return false;
  }
}

export async function setMonthEndReminderOn(on: boolean): Promise<boolean> {
  if (!on) {
    setMonthEndReminderEnabled(false);
    await cancelMonthEndReminder();
    return false;
  }
  return requestMonthEndReminderPermission();
}

export function isMonthEndReminderResponse(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  if (!response) {
    return false;
  }
  if (response.notification.request.identifier === MONTH_END_REMINDER_ID) {
    return true;
  }
  return response.notification.request.content.data?.kind === MONTH_END_REMINDER_KIND;
}

export function clearHandledMonthEndReminder(): void {
  try {
    Notifications.clearLastNotificationResponse();
  } catch (error) {
    console.error('clearHandledMonthEndReminder failed', error);
  }
}
