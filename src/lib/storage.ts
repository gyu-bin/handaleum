import Storage from 'expo-sqlite/kv-store';

const LAST_VIEWED_MONTH_KEY = 'lastViewedMonth';
const LAST_CALENDAR_MONTH_KEY = 'lastCalendarMonth';
const MAP_THEME_KEY = 'mapThemeId';
const PIN_COVERS_PREFIX = 'pinCovers:';
const HOME_LOCATION_KEY = 'homeLocation';
const ASSET_LOCATION_PREFIX = 'assetLoc:';
const ONBOARDING_SEEN_KEY = 'onboardingSeen';

/**
 * Synchronous key-value facade backed by expo-sqlite/kv-store
 * (bundled in Expo Go — replaced MMKV, decision 2026-07-18).
 */
type KvStore = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string | number | boolean) => void;
  remove: (key: string) => void;
};

export const storage: KvStore = {
  getString: (key) => {
    try {
      return Storage.getItemSync(key) ?? undefined;
    } catch (error) {
      console.error('storage.getString failed', key, error);
      return undefined;
    }
  },
  set: (key, value) => {
    try {
      Storage.setItemSync(key, String(value));
    } catch (error) {
      console.error('storage.set failed', key, error);
    }
  },
  remove: (key) => {
    try {
      Storage.removeItemSync(key);
    } catch (error) {
      console.error('storage.remove failed', key, error);
    }
  },
};

/** Last viewed month (YYYY-MM). App setting, no global store needed. */
export function getLastViewedMonth(): string | null {
  return storage.getString(LAST_VIEWED_MONTH_KEY) ?? null;
}

export function setLastViewedMonth(month: string): void {
  storage.set(LAST_VIEWED_MONTH_KEY, month);
}

/** Calendar YYYY-MM when we last auto-landed on this month. */
export function getLastCalendarMonth(): string | null {
  return storage.getString(LAST_CALENDAR_MONTH_KEY) ?? null;
}

export function setLastCalendarMonth(month: string): void {
  storage.set(LAST_CALENDAR_MONTH_KEY, month);
}

/** Paper map palette id (`dawn` | `ink` | `warm`). */
export function getMapThemeId(): string | null {
  return storage.getString(MAP_THEME_KEY) ?? null;
}

export function setMapThemeId(id: string): void {
  storage.set(MAP_THEME_KEY, id);
}

/** JSON map of placeKey → assetId for one month. */
export function getPinCoversRaw(month: string): string | null {
  return storage.getString(`${PIN_COVERS_PREFIX}${month}`) ?? null;
}

export function setPinCoversRaw(month: string, json: string): void {
  storage.set(`${PIN_COVERS_PREFIX}${month}`, json);
}

/** JSON `{ lat, lng, radiusM }` — photos near home are kept out of recaps. */
export function getHomeLocationRaw(): string | null {
  return storage.getString(HOME_LOCATION_KEY) ?? null;
}

export function setHomeLocationRaw(json: string): void {
  storage.set(HOME_LOCATION_KEY, json);
}

export function clearHomeLocationRaw(): void {
  storage.remove(HOME_LOCATION_KEY);
}

/** First-run onboarding shown once. Absent = not yet seen. */
export function getOnboardingSeen(): boolean {
  return storage.getString(ONBOARDING_SEEN_KEY) === '1';
}

export function setOnboardingSeen(): void {
  storage.set(ONBOARDING_SEEN_KEY, '1');
}

/**
 * Per-asset GPS cache: "lat,lng" or "x" (checked, no location). A photo's GPS
 * is effectively immutable, and `getAssetInfoAsync` is the dominant cost of a
 * month load — one native call per photo — so cached assets skip it entirely.
 */
export function getAssetLocationRaw(assetId: string): string | null {
  return storage.getString(`${ASSET_LOCATION_PREFIX}${assetId}`) ?? null;
}

export function setAssetLocationRaw(assetId: string, value: string): void {
  storage.set(`${ASSET_LOCATION_PREFIX}${assetId}`, value);
}

const PLACE_FIRST_SEEN_KEY = 'placeFirstSeen';
const IS_PRO_KEY = 'isPro';
const STAMPS_COLLECTED_KEY = 'stampsCollected';
const STAMPS_UNSEEN_KEY = 'stampsUnseen';

/** JSON map of familiar place label → earliest YYYY-MM visited. */
export function getPlaceFirstSeenRaw(): string | null {
  return storage.getString(PLACE_FIRST_SEEN_KEY) ?? null;
}

export function setPlaceFirstSeenRaw(json: string): void {
  storage.set(PLACE_FIRST_SEEN_KEY, json);
}

/** Local pro gate until RevenueCat. Absent / not "1" = free. */
export function getIsProRaw(): boolean {
  return storage.getString(IS_PRO_KEY) === '1';
}

export function setIsProRaw(value: boolean): void {
  if (value) {
    storage.set(IS_PRO_KEY, '1');
  } else {
    storage.remove(IS_PRO_KEY);
  }
}

const DEV_DUMMY_PHOTOS_KEY = 'devDummyPhotos';

/**
 * Dev-only sample photos. Absent in __DEV__ ⇒ on (simulator-friendly).
 * Explicit "0" turns it off. Production always reads as off via the helper.
 */
export function getDevDummyPhotosRaw(): string | null {
  return storage.getString(DEV_DUMMY_PHOTOS_KEY) ?? null;
}

export function setDevDummyPhotosRaw(enabled: boolean): void {
  storage.set(DEV_DUMMY_PHOTOS_KEY, enabled ? '1' : '0');
}

/** Last applied `DUMMY_HUBS_REV` (stamp sync wiped for new sample hubs). */
const DEV_DUMMY_HUBS_REV_KEY = 'devDummyHubsRev';

export function getDevDummyHubsRev(): number {
  const raw = storage.getString(DEV_DUMMY_HUBS_REV_KEY);
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setDevDummyHubsRev(rev: number): void {
  storage.set(DEV_DUMMY_HUBS_REV_KEY, String(rev));
}

/** JSON map of stampId → { name, sido, firstMonth }. */
export function getStampsRaw(): string | null {
  return storage.getString(STAMPS_COLLECTED_KEY) ?? null;
}

export function setStampsRaw(json: string): void {
  storage.set(STAMPS_COLLECTED_KEY, json);
}

/** JSON string[] of stampIds not yet viewed on the 발도장 screen. */
export function getStampsUnseenRaw(): string | null {
  return storage.getString(STAMPS_UNSEEN_KEY) ?? null;
}

export function setStampsUnseenRaw(json: string): void {
  storage.set(STAMPS_UNSEEN_KEY, json);
}

const STAMPS_SCAN_INTRO_KEY = 'stampsScanIntroSeen';

/** First-visit notice: full-album stamp scan may take a while. */
export function getStampsScanIntroSeen(): boolean {
  return storage.getString(STAMPS_SCAN_INTRO_KEY) === '1';
}

export function setStampsScanIntroSeen(): void {
  storage.set(STAMPS_SCAN_INTRO_KEY, '1');
}

const STAMPS_LIBRARY_SYNC_AT_KEY = 'stampsLibrarySyncAt';
/** Epoch ms when full-album GPS phase last finished (geocode may still run). */
const STAMPS_GPS_SCAN_AT_KEY = 'stampsGpsScanAt';
/** Bump when place→구 parse changes so cooldown cannot hide new stamps. */
const STAMPS_PLACE_PARSE_REV_KEY = 'stampsPlaceParseRev';
/** Bump forces one full-album stamp rescan (place→구 parse change). */
export const STAMPS_PLACE_PARSE_REV = 17;

/** Epoch ms of last finished full-album stamp sync (0 if never). */
export function getStampsLibrarySyncAt(): number {
  const raw = storage.getString(STAMPS_LIBRARY_SYNC_AT_KEY);
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setStampsLibrarySyncAt(atMs: number): void {
  storage.set(STAMPS_LIBRARY_SYNC_AT_KEY, String(atMs));
}

/** Epoch ms of last finished library GPS scan (0 if never). */
export function getStampsGpsScanAt(): number {
  const raw = storage.getString(STAMPS_GPS_SCAN_AT_KEY);
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setStampsGpsScanAt(atMs: number): void {
  storage.set(STAMPS_GPS_SCAN_AT_KEY, String(atMs));
}

/** Epoch ms when coarse (~1km) stamp geocode pass finished. */
const STAMPS_COARSE_GEOCODE_AT_KEY = 'stampsCoarseGeocodeAt';

export function getStampsCoarseGeocodeAt(): number {
  const raw = storage.getString(STAMPS_COARSE_GEOCODE_AT_KEY);
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setStampsCoarseGeocodeAt(atMs: number): void {
  storage.set(STAMPS_COARSE_GEOCODE_AT_KEY, String(atMs));
}

export function getStampsPlaceParseRev(): number {
  const raw = storage.getString(STAMPS_PLACE_PARSE_REV_KEY);
  if (!raw) {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function setStampsPlaceParseRev(rev: number): void {
  storage.set(STAMPS_PLACE_PARSE_REV_KEY, String(rev));
}

/**
 * Persisted reverse-geocode result per ~110m bucket (placeRes:{rev}:{lat,lng}).
 * GPS coords are in assetLoc; place *names* live here so cold start can show
 * chips/sheet labels without waiting for CLGeocoder again.
 */
const PLACE_RESOLVE_PREFIX = 'placeRes:';

export function getPlaceResolveRaw(cacheKey: string): string | null {
  return storage.getString(`${PLACE_RESOLVE_PREFIX}${cacheKey}`) ?? null;
}

export function setPlaceResolveRaw(cacheKey: string, json: string): void {
  storage.set(`${PLACE_RESOLVE_PREFIX}${cacheKey}`, json);
}

/** JSON map of recap nodeId → assetId for one month. */
const RECAP_COVERS_PREFIX = 'recapCovers:';

export function getRecapCoversRaw(month: string): string | null {
  return storage.getString(`${RECAP_COVERS_PREFIX}${month}`) ?? null;
}

export function setRecapCoversRaw(month: string, json: string): void {
  storage.set(`${RECAP_COVERS_PREFIX}${month}`, json);
}

/** JSON map of place identity → user alias for recap board labels. */
const PLACE_ALIASES_KEY = 'placeAliases';

export function getPlaceAliasesRaw(): string | null {
  return storage.getString(PLACE_ALIASES_KEY) ?? null;
}

export function setPlaceAliasesRaw(json: string): void {
  storage.set(PLACE_ALIASES_KEY, json);
}

/** JSON string[] of assetIds hidden from map + recap for one month. */
const HIDDEN_PHOTOS_PREFIX = 'hiddenPhotos:';

export function getHiddenPhotosRaw(month: string): string | null {
  return storage.getString(`${HIDDEN_PHOTOS_PREFIX}${month}`) ?? null;
}

export function setHiddenPhotosRaw(month: string, json: string): void {
  storage.set(`${HIDDEN_PHOTOS_PREFIX}${month}`, json);
}

/** In-app dark mode. Absent / not "1" = light. Does not follow the system. */
const DARK_MODE_KEY = 'darkMode';

export function getDarkModeEnabled(): boolean {
  return storage.getString(DARK_MODE_KEY) === '1';
}

export function setDarkModeEnabled(enabled: boolean): void {
  if (enabled) {
    storage.set(DARK_MODE_KEY, '1');
  } else {
    storage.set(DARK_MODE_KEY, '0');
  }
}

/**
 * Month-end recap local reminder. Absent = on (after OS permission).
 * Explicit "0" cancels the scheduled notification.
 */
const MONTH_END_REMINDER_KEY = 'monthEndReminder';

export function getMonthEndReminderEnabled(): boolean {
  return storage.getString(MONTH_END_REMINDER_KEY) !== '0';
}

export function setMonthEndReminderEnabled(enabled: boolean): void {
  storage.set(MONTH_END_REMINDER_KEY, enabled ? '1' : '0');
}

/** Local calendar day `YYYY-MM-DD` when this build first launched. */
const PHOTO_STREAK_EPOCH_KEY = 'photoStreakEpoch';

export function getPhotoStreakEpoch(): string | null {
  return storage.getString(PHOTO_STREAK_EPOCH_KEY) ?? null;
}

export function setPhotoStreakEpoch(day: string): void {
  storage.set(PHOTO_STREAK_EPOCH_KEY, day);
}

/** JSON `{ "YYYY-MM": ["YYYY-MM-DD", ...] }` — GPS recap days per month. */
const PHOTO_STREAK_DAYS_KEY = 'photoStreakDays';

export function getPhotoStreakDaysRaw(): string | null {
  return storage.getString(PHOTO_STREAK_DAYS_KEY) ?? null;
}

export function setPhotoStreakDaysRaw(json: string): void {
  storage.set(PHOTO_STREAK_DAYS_KEY, json);
}

/** Highest 10-day streak milestone already shown in-app (0 = none). */
const PHOTO_STREAK_MILESTONE_SENT_KEY = 'photoStreakMilestoneSent';

export function getPhotoStreakMilestoneSent(): number {
  const raw = storage.getString(PHOTO_STREAK_MILESTONE_SENT_KEY);
  const n = raw == null ? 0 : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function setPhotoStreakMilestoneSent(days: number): void {
  storage.set(PHOTO_STREAK_MILESTONE_SENT_KEY, String(Math.max(0, days)));
}
