/**
 * Month-end local reminder — native API disabled for store 1.0.0 (build 15).
 * That binary has no expo-notifications; importing it crashes the OTA and
 * Expo rolls back to the embedded JS. Restore the Notifications import after
 * the next store native build.
 */

export const MONTH_END_REMINDER_ID = 'month-end-reminder';
export const MONTH_END_REMINDER_KIND = 'month-end';

export type MonthEndReminderPermission = 'undetermined' | 'granted' | 'denied';

export function configureMonthEndReminder(): void {}

export async function getMonthEndReminderPermission(): Promise<MonthEndReminderPermission> {
  return 'denied';
}

export async function cancelMonthEndReminder(): Promise<void> {}

export async function syncMonthEndReminder(_now = new Date()): Promise<void> {}

export async function requestMonthEndReminderPermission(): Promise<boolean> {
  return false;
}

export async function setMonthEndReminderOn(_on: boolean): Promise<boolean> {
  return false;
}

export function isMonthEndReminderResponse(
  _response: unknown,
): boolean {
  return false;
}

export function clearHandledMonthEndReminder(): void {}
