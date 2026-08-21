/** Local hour for the month-end recap reminder. */
export const MONTH_END_HOUR = 21;

/**
 * Next last-day-of-month at 21:00 local time.
 * If that instant has already been reached this month, returns next month's.
 */
export function nextMonthEndAt(now: Date): Date {
  const year = now.getFullYear();
  const month0 = now.getMonth();
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  const fire = new Date(year, month0, lastDay, MONTH_END_HOUR, 0, 0, 0);
  if (now < fire) {
    return fire;
  }
  const nextLast = new Date(year, month0 + 2, 0);
  return new Date(
    nextLast.getFullYear(),
    nextLast.getMonth(),
    nextLast.getDate(),
    MONTH_END_HOUR,
    0,
    0,
    0,
  );
}
