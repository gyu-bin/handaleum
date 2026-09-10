import { Platform } from 'react-native';
import {
  cacheDirectory,
  copyAsync,
  deleteAsync,
  documentDirectory,
  downloadAsync,
  getInfoAsync,
} from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Notifications from 'expo-notifications';

import { stampId } from '@/features/stamps/services/dongIndex';
import { lookupDong } from '@/features/stamps/services/dongLookup';
import { readLocatedPhotosSnapshot } from '@/features/stamps/services/locatedPhotosSnapshot';
import { readStampsCollected } from '@/features/stamps/services/stampsStorage';
import { strings } from '@/shared/constants/strings';

import type { MonthKey, PhotoRef } from '../types';
import { monthKeySchema } from '../schema';
import {
  MEMORY_REMINDER_HOUR,
  clampDayAwayFromMonthEnd,
  pickMemoryDay,
  photosInMonth,
  type MemoryPick,
} from '../utils/pickMemoryDay';
import { currentMonthKey, shiftMonthKey } from '../utils/month';
import { dummyAssetImageUri, isDummyAssetId } from './dummyPhotos';
import { resolveAssetFileUri } from './mediaLibrary';
import { readPinThumbFromDisk } from './pinThumbCache';
import {
  getMonthEndReminderPermission,
  type MonthEndReminderPermission,
} from './monthEndReminder';

export const MEMORY_REMINDER_ID = 'memory-reminder';
export const MEMORY_REMINDER_KIND = 'memory';

const CHANNEL_ID = 'memory';
/** Staging name only — final attach path is unique (system moves the file). */
const ATTACH_STAGE = 'memory-reminder-stage.jpg';
/** Walk back at most this many months when last-year is empty. */
const FALLBACK_MONTH_SCAN = 24;

function stampIdOf(lat: number, lng: number): string | null {
  const hit = lookupDong(lat, lng);
  if (!hit) {
    return null;
  }
  return stampId(hit.sido, hit.city, hit.name);
}

function newStampsForMonth(month: MonthKey): { id: string; name: string }[] {
  const collected = readStampsCollected();
  const out: { id: string; name: string }[] = [];
  for (const [id, entry] of Object.entries(collected)) {
    if (entry.firstMonth === month) {
      out.push({ id, name: entry.name });
    }
  }
  return out;
}

function monthNumber(month: MonthKey): number {
  return Number(month.slice(5, 7));
}

function copyForPick(pick: MemoryPick, sendIsCurrent: boolean): {
  title: string;
  body: string;
} {
  const n = monthNumber(pick.contentMonth);
  if (pick.kind === 'newDong' && pick.dongName) {
    return {
      title: strings.memoryReminder.titleNewDong(n, pick.dongName),
      body: strings.memoryReminder.body,
    };
  }
  if (pick.kind === 'mostPhotos') {
    return {
      title: strings.memoryReminder.titleMost(n),
      body: strings.memoryReminder.body,
    };
  }
  if (sendIsCurrent && pick.contentMonth === currentMonthKey()) {
    return {
      title: strings.memoryReminder.titleThisMonth,
      body: strings.memoryReminder.bodyThisMonth,
    };
  }
  return {
    title: strings.memoryReminder.titleFallback(n),
    body: strings.memoryReminder.body,
  };
}

function fireDateInMonth(sendMonth: MonthKey, day: number): Date {
  const [y, m] = sendMonth.split('-').map(Number) as [number, number];
  const lastDay = new Date(y, m, 0).getDate();
  const safeDay = clampDayAwayFromMonthEnd(day, lastDay);
  return new Date(y, m - 1, safeDay, MEMORY_REMINDER_HOUR, 0, 0, 0);
}

function pickContentForSendMonth(
  sendMonth: MonthKey,
  photos: PhotoRef[],
): MemoryPick {
  const prefer = shiftMonthKey(sendMonth, -12);
  let pick = pickMemoryDay(
    prefer,
    photos,
    newStampsForMonth(prefer),
    stampIdOf,
  );

  if (!pick) {
    let cursor = shiftMonthKey(sendMonth, -1);
    for (let i = 0; i < FALLBACK_MONTH_SCAN; i += 1) {
      pick = pickMemoryDay(
        cursor,
        photos,
        newStampsForMonth(cursor),
        stampIdOf,
      );
      if (pick) {
        break;
      }
      cursor = shiftMonthKey(cursor, -1);
    }
  }

  if (!pick) {
    const inMonth = photosInMonth(photos, sendMonth);
    if (inMonth.length > 0) {
      pick = pickMemoryDay(
        sendMonth,
        photos,
        newStampsForMonth(sendMonth),
        stampIdOf,
      );
    }
  }

  if (!pick) {
    const [y, m] = sendMonth.split('-').map(Number) as [number, number];
    const lastDay = new Date(y, m, 0).getDate();
    pick = {
      contentMonth: sendMonth,
      day: clampDayAwayFromMonthEnd(15, lastDay),
      kind: 'fallback',
      assetId: '',
    };
  }

  return pick;
}

function planFromPhotos(
  sendMonth: MonthKey,
  photos: PhotoRef[],
  now: Date,
): { pick: MemoryPick; fire: Date } | null {
  const pick = pickContentForSendMonth(sendMonth, photos);
  const fire = fireDateInMonth(sendMonth, pick.day);
  if (fire <= now) {
    return null;
  }
  return { pick, fire };
}

async function loadPhotos(): Promise<PhotoRef[]> {
  const snap = await readLocatedPhotosSnapshot();
  return snap ?? [];
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: strings.memoryReminder.channelName,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function attachRoot(): string | null {
  return cacheDirectory ?? documentDirectory;
}

/**
 * Re-encode to a square baseline JPEG for banner thumbnails.
 * Keep ≥512px — iOS 26+ logs dynamic_thumbnail minimum ~384–492px.
 * Unique dest each call — UNNotificationAttachment may move the source file.
 *
 * Note: iOS Simulator (26.5/27) often fails QL thumbnail generation for
 * notification attachments (QLThumbnailErrorDomain) even when the file is
 * valid; verify banner thumbnails on a physical device.
 */
async function toBannerJpeg(src: string): Promise<string | null> {
  const root = attachRoot();
  if (!root) {
    return null;
  }
  const sized = await manipulateAsync(src, [{ resize: { width: 1024 } }], {
    compress: 1,
    format: SaveFormat.JPEG,
  });
  const side = Math.min(sized.width, sized.height);
  const originX = Math.max(0, Math.floor((sized.width - side) / 2));
  const originY = Math.max(0, Math.floor((sized.height - side) / 2));
  const baked = await manipulateAsync(
    sized.uri,
    [{ crop: { originX, originY, width: side, height: side } }],
    { compress: 0.9, format: SaveFormat.JPEG },
  );
  const dest = `${root}memory-attach-${Date.now()}.jpg`;
  const existing = await getInfoAsync(dest);
  if (existing.exists) {
    await deleteAsync(dest, { idempotent: true });
  }
  await copyAsync({ from: baked.uri, to: dest });
  const info = await getInfoAsync(dest);
  if (!info.exists || info.isDirectory || (info.size ?? 0) < 100) {
    return null;
  }
  return dest;
}

async function stageRemoteOrFile(src: string): Promise<string | null> {
  const root = attachRoot();
  if (!root) {
    return null;
  }
  const stage = `${root}${ATTACH_STAGE}`;
  const existing = await getInfoAsync(stage);
  if (existing.exists) {
    await deleteAsync(stage, { idempotent: true });
  }
  if (src.startsWith('http://') || src.startsWith('https://')) {
    await downloadAsync(src, stage);
  } else {
    await copyAsync({ from: src, to: stage });
  }
  const info = await getInfoAsync(stage);
  if (!info.exists || info.isDirectory) {
    return null;
  }
  return stage;
}

/**
 * Local baseline jpeg for UNNotificationAttachment (banner thumbnail).
 */
async function bakeAttachment(assetId: string): Promise<string | null> {
  if (!assetId || !attachRoot()) {
    return null;
  }
  try {
    const candidates: string[] = [];
    const disk = await readPinThumbFromDisk(assetId);
    if (disk) {
      candidates.push(disk);
    }
    if (isDummyAssetId(assetId)) {
      candidates.push(dummyAssetImageUri(assetId, 512));
    }
    const resolved = await resolveAssetFileUri(assetId);
    if (resolved) {
      candidates.push(resolved);
    }
    if (Platform.OS === 'ios' && !isDummyAssetId(assetId)) {
      candidates.push(`ph://${assetId}`);
    }

    for (const raw of candidates) {
      try {
        let src = raw;
        if (
          raw.startsWith('http://') ||
          raw.startsWith('https://') ||
          raw.startsWith('file:') ||
          raw.startsWith('content:')
        ) {
          const staged = await stageRemoteOrFile(raw);
          if (!staged) {
            continue;
          }
          src = staged;
        }
        const out = await toBannerJpeg(src);
        if (out) {
          return out;
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(
            '[memoryReminder] bake candidate failed',
            raw.slice(0, 56),
            error,
          );
        }
      }
    }
    return null;
  } catch (error) {
    console.error('memoryReminder bakeAttachment failed', assetId.slice(0, 48), error);
    return null;
  }
}

/**
 * iOS UNNotificationAttachment payload.
 * Native (Records.swift) reads `uri` only — keep options minimal so thumbnail
 * generation is not rejected by a bad typeHint.
 */
function iosPhotoAttachment(
  fileUri: string,
): Notifications.NotificationContentAttachmentIos {
  // Pass both keys; patched native prefers uri then url.
  // Omit type/typeHint — bad hints hide thumbnails on some iOS versions.
  return {
    identifier: 'memory-photo',
    url: fileUri,
    type: null,
    ...({ uri: fileUri } as Record<string, string>),
  };
}

export async function cancelMemoryReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(MEMORY_REMINDER_ID);
  } catch (error) {
    console.error('cancelMemoryReminder failed', error);
  }
}

const TEST_MEMORY_ID = 'memory-reminder-test';

/**
 * Foreground banner now — same content path as the scheduled mid-month reminder.
 * Does not change the pending DATE schedule.
 * Resolves `{ ok, attached }` so the settings test can surface missing thumbs.
 */
export async function sendTestMemoryNotification(
  now = new Date(),
): Promise<{ ok: boolean; attached: boolean }> {
  try {
    const permission = await getMonthEndReminderPermission();
    if (permission !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: true },
      });
      if (status !== 'granted') {
        return { ok: false, attached: false };
      }
    }

    const photos = await loadPhotos();
    const pick = pickContentForSendMonth(currentMonthKey(now), photos);
    const { title, body } = copyForPick(pick, true);
    const attachUri = pick.assetId
      ? await bakeAttachment(pick.assetId)
      : null;

    await ensureAndroidChannel();
    // Delayed delivery: foreground banners often omit the trailing photo;
    // SpringBoard banners show UNNotificationAttachment thumbnails.
    await Notifications.scheduleNotificationAsync({
      identifier: TEST_MEMORY_ID,
      content: {
        title,
        body,
        sound: true,
        data: {
          kind: MEMORY_REMINDER_KIND,
          month: pick.contentMonth,
          ...(pick.assetId ? { assetId: pick.assetId } : {}),
        },
        ...(attachUri
          ? {
              attachments: [iosPhotoAttachment(attachUri)],
            }
          : {}),
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
      },
    });
    if (__DEV__) {
      console.warn('[memoryReminder] test scheduled in 5s', {
        title,
        attached: Boolean(attachUri),
        assetId: pick.assetId.slice(0, 40),
        file: attachUri?.slice(-48),
      });
    }
    return { ok: true, attached: Boolean(attachUri) };
  } catch (error) {
    console.error('sendTestMemoryNotification failed', error);
    return { ok: false, attached: false };
  }
}

/**
 * Schedule the next mid-month memory local notification (at most one pending).
 * No settings toggle — runs whenever OS notification permission is granted.
 */
export async function syncMemoryReminder(now = new Date()): Promise<void> {
  try {
    const permission: MonthEndReminderPermission =
      await getMonthEndReminderPermission();
    if (permission !== 'granted') {
      await cancelMemoryReminder();
      return;
    }

    const photos = await loadPhotos();
    let sendMonth = currentMonthKey(now);
    let planned = planFromPhotos(sendMonth, photos, now);
    if (!planned) {
      sendMonth = shiftMonthKey(sendMonth, 1);
      planned = planFromPhotos(sendMonth, photos, now);
    }
    if (!planned) {
      await cancelMemoryReminder();
      return;
    }

    const { pick, fire } = planned;
    const sendIsCurrent = sendMonth === currentMonthKey(now);
    const { title, body } = copyForPick(pick, sendIsCurrent);
    const attachUri = pick.assetId
      ? await bakeAttachment(pick.assetId)
      : null;

    await ensureAndroidChannel();
    await Notifications.cancelScheduledNotificationAsync(MEMORY_REMINDER_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: MEMORY_REMINDER_ID,
      content: {
        title,
        body,
        sound: true,
        data: {
          kind: MEMORY_REMINDER_KIND,
          month: pick.contentMonth,
          ...(pick.assetId ? { assetId: pick.assetId } : {}),
        },
        ...(attachUri
          ? {
              attachments: [iosPhotoAttachment(attachUri)],
            }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire,
        channelId: CHANNEL_ID,
      },
    });
    if (__DEV__) {
      console.warn(
        '[memoryReminder] scheduled',
        fire.toISOString(),
        pick.kind,
        pick.contentMonth,
        pick.dongName ?? '',
        attachUri ? 'attach' : 'no-attach',
      );
    }
  } catch (error) {
    console.error('syncMemoryReminder failed', error);
  }
}

export function isMemoryReminderResponse(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  if (!response) {
    return false;
  }
  if (response.notification.request.identifier === MEMORY_REMINDER_ID) {
    return true;
  }
  return (
    response.notification.request.content.data?.kind === MEMORY_REMINDER_KIND
  );
}

export function memoryMonthFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): MonthKey | null {
  if (!response || !isMemoryReminderResponse(response)) {
    return null;
  }
  const raw = response.notification.request.content.data?.month;
  if (typeof raw !== 'string') {
    return null;
  }
  const parsed = monthKeySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Asset to focus in 몰아보기 when the memory notification is opened. */
export function memoryAssetIdFromResponse(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  if (!response || !isMemoryReminderResponse(response)) {
    return null;
  }
  const raw = response.notification.request.content.data?.assetId;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export function clearHandledMemoryReminder(): void {
  try {
    Notifications.clearLastNotificationResponse();
  } catch (error) {
    console.error('clearHandledMemoryReminder failed', error);
  }
}
