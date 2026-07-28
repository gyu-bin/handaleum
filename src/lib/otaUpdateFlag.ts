import { storage } from '@/lib/storage';

const OTA_JUST_APPLIED_KEY = 'handaleum-ota-just-applied';

/** Call right before `Updates.reloadAsync()` — consumed on the next boot. */
export function markOtaJustApplied(): void {
  storage.set(OTA_JUST_APPLIED_KEY, String(Date.now()));
}

/** One-shot: true → show “업데이트 완료” toast after splash. */
export function consumeOtaJustApplied(): boolean {
  const value = storage.getString(OTA_JUST_APPLIED_KEY);
  if (value == null) {
    return false;
  }
  storage.remove(OTA_JUST_APPLIED_KEY);
  return true;
}
