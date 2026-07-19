import Storage from 'expo-sqlite/kv-store';

const LAST_VIEWED_MONTH_KEY = 'lastViewedMonth';
const MAP_THEME_KEY = 'mapThemeId';
const PIN_COVERS_PREFIX = 'pinCovers:';
const HOME_LOCATION_KEY = 'homeLocation';

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
