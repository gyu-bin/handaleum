import Storage from 'expo-sqlite/kv-store';

const LAST_VIEWED_MONTH_KEY = 'lastViewedMonth';
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
  getString: (key) => Storage.getItemSync(key) ?? undefined,
  set: (key, value) => {
    Storage.setItemSync(key, String(value));
  },
  remove: (key) => {
    Storage.removeItemSync(key);
  },
};

/** Last viewed month (YYYY-MM). App setting, no global store needed. */
export function getLastViewedMonth(): string | null {
  return storage.getString(LAST_VIEWED_MONTH_KEY) ?? null;
}

export function setLastViewedMonth(month: string): void {
  storage.set(LAST_VIEWED_MONTH_KEY, month);
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
