/** Pure rank for 요약 top places — photo count desc, then latest visit desc. */
export function rankSummaryTopPlaces<
  T extends { photoCount: number; latestTakenAt: string },
>(rows: T[], limit: number): T[] {
  if (limit <= 0 || rows.length === 0) {
    return [];
  }
  return [...rows]
    .sort(
      (a, b) =>
        b.photoCount - a.photoCount ||
        b.latestTakenAt.localeCompare(a.latestTakenAt),
    )
    .slice(0, limit);
}
