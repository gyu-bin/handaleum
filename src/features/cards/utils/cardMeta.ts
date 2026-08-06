/** "2026-07" → "2026. 07" — instrument-plate month label. */
export function formatMonthDot(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}. ${mon}`;
}
