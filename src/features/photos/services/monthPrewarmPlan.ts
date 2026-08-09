/** Cap how many non-priority month photos we pre-bake. */
export const DEFAULT_MONTH_FILL_MAX = 160;

/** Pure plan — priority first, then capped month fill (no RN imports). */
export function planMonthPrewarmIds(
  priorityIds: string[],
  monthAssetIds: string[],
  maxMonthFill = DEFAULT_MONTH_FILL_MAX,
): { priority: string[]; fill: string[] } {
  const seen = new Set<string>();
  const priority: string[] = [];
  for (const id of priorityIds) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    priority.push(id);
  }
  const fill: string[] = [];
  const fillCap = Math.max(0, maxMonthFill);
  for (const id of monthAssetIds) {
    if (!id || seen.has(id)) {
      continue;
    }
    if (fill.length >= fillCap) {
      break;
    }
    seen.add(id);
    fill.push(id);
  }
  return { priority, fill };
}
