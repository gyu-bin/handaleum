import type { MonthKey, PhotoRef } from '../../photos/types';
import { monthBounds } from '../../photos/utils/month';

export type RecapBoardMode = 'place' | 'day';

export type RecapBoardNode = {
  id: string;
  label: string;
  assetId: string | null;
  photoCount: number;
  /** Calendar pad — occupies a weekday slot, no circle. */
  blank?: boolean;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function daysInMonth(month: MonthKey): number {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  return new Date(year, mon, 0).getDate();
}

/** Local calendar day `YYYY-MM-DD` for a photo timestamp. */
export function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function snakeRows<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    const chunk = items.slice(i, i + cols);
    const rowIndex = rows.length;
    rows.push(rowIndex % 2 === 1 ? [...chunk].reverse() : chunk);
  }
  return rows;
}

/** Left-to-right rows (monthly calendar, not snake). */
export function chunkRows<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

/** Split a snake into pages of `maxRows` so the board can page horizontally. */
export function recapBoardPages<T>(
  items: T[],
  cols: number,
  maxRows: number,
): T[][] {
  const perPage = Math.max(1, cols * maxRows);
  if (items.length === 0) {
    return [];
  }
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

/** Grid slot for index `i` in a left-right / right-left snake. */
export function snakeCell(
  index: number,
  cols: number,
): { row: number; col: number } {
  const row = Math.floor(index / cols);
  const colInRow = index % cols;
  const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;
  return { row, col };
}

/**
 * Hairline rail through snake cell centers. Horizontal runs, U-turn
 * cubics at row changes. Empty string if there is nothing to join.
 */
export function snakeRailPath(
  count: number,
  cols: number,
  cell: number,
  rowH: number,
  circleCy: number,
  gapX = 0,
): string {
  if (count < 2 || cols < 1) {
    return '';
  }
  const step = cell + gapX;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const { row, col } = snakeCell(i, cols);
    pts.push({
      x: col * step + cell / 2,
      y: row * rowH + circleCy,
    });
  }
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (a.y === b.y) {
      d += ` L ${b.x} ${b.y}`;
    } else {
      const midY = (a.y + b.y) / 2;
      d += ` C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    }
  }
  return d;
}

export function recapDayNodes(
  month: MonthKey,
  photos: PhotoRef[],
): RecapBoardNode[] {
  const byDay = new Map<string, PhotoRef[]>();
  const { startMs, endMs } = monthBounds(month);
  for (const photo of photos) {
    const ms = new Date(photo.takenAt).getTime();
    if (ms < startMs || ms >= endMs) {
      continue;
    }
    const key = localDayKey(photo.takenAt);
    const list = byDay.get(key);
    if (list) {
      list.push(photo);
    } else {
      byDay.set(key, [photo]);
    }
  }

  const days = daysInMonth(month);
  const nodes: RecapBoardNode[] = [];
  for (let day = 1; day <= days; day += 1) {
    const key = `${month}-${pad2(day)}`;
    const list = byDay.get(key) ?? [];
    list.sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    nodes.push({
      id: key,
      label: String(day),
      assetId: list[0]?.assetId ?? null,
      photoCount: list.length,
    });
  }
  return nodes;
}

export function recapDayPhotos(
  dayKey: string,
  photos: PhotoRef[],
): PhotoRef[] {
  return photos
    .filter((photo) => localDayKey(photo.takenAt) === dayKey)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));
}

/** Chosen cover, else a pin-cover that is in this node, else the first photo. */
export function resolveRecapCoverAssetId(
  nodeId: string,
  assetIds: string[],
  recapCovers: Record<string, string>,
  pinCoverAssetId: string | null,
): string | null {
  if (assetIds.length === 0) {
    return null;
  }
  const ids = new Set(assetIds);
  const recap =
    recapCovers[nodeId] ?? recapCovers[placeIdentityFromVisitNodeId(nodeId)];
  if (recap && ids.has(recap)) {
    return recap;
  }
  if (pinCoverAssetId && ids.has(pinCoverAssetId)) {
    return pinCoverAssetId;
  }
  return assetIds[0] ?? null;
}

/** Sunday = 0 … Saturday = 6, local calendar. */
export function monthStartWeekday(month: MonthKey): number {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  return new Date(year, mon - 1, 1).getDay();
}

function blankNode(id: string): RecapBoardNode {
  return { id, label: '', assetId: null, photoCount: 0, blank: true };
}

/**
 * Month days plus leading/trailing pads so the grid is a Sun–Sat calendar.
 */
export function recapDayCalendarNodes(
  month: MonthKey,
  photos: PhotoRef[],
): RecapBoardNode[] {
  const days = recapDayNodes(month, photos);
  const lead = monthStartWeekday(month);
  const leadNodes = Array.from({ length: lead }, (_, i) =>
    blankNode(`pad-lead:${i}`),
  );
  const trail = (7 - ((lead + days.length) % 7)) % 7;
  const trailNodes = Array.from({ length: trail }, (_, i) =>
    blankNode(`pad-trail:${i}`),
  );
  return [...leadNodes, ...days, ...trailNodes];
}

export function placeIdentity(place: {
  city?: string | null;
  gu?: string | null;
  eupMyon?: string | null;
  dong?: string | null;
  label?: string;
  detailLabel?: string;
}): string {
  return (
    [place.city, place.gu, place.eupMyon, place.dong].filter(Boolean).join('|') ||
    place.detailLabel ||
    place.label ||
    ''
  );
}

const VISIT_DAY_SUFFIX = /@(\d{4}-\d{2}-\d{2})$/;

/** Place-view cell: same admin identity on another calendar day is a new stop. */
export function placeVisitNodeId(identity: string, dayKey: string): string {
  return `${identity}@${dayKey}`;
}

export function placeIdentityFromVisitNodeId(nodeId: string): string {
  return nodeId.replace(VISIT_DAY_SUFFIX, '');
}

/** Group photos by admin identity × local day, earliest-first. */
export function groupPhotosByPlaceDay(
  photos: PhotoRef[],
  identityOf: (photo: PhotoRef) => string,
): { id: string; photos: PhotoRef[] }[] {
  const photosById = new Map<string, PhotoRef[]>();
  for (const photo of photos) {
    const id = placeVisitNodeId(identityOf(photo), localDayKey(photo.takenAt));
    const list = photosById.get(id);
    if (list) {
      list.push(photo);
    } else {
      photosById.set(id, [photo]);
    }
  }
  return [...photosById.entries()]
    .map(([id, list]) => ({
      id,
      photos: [...list].sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    }))
    .sort((a, b) =>
      (a.photos[0]?.takenAt ?? '').localeCompare(b.photos[0]?.takenAt ?? ''),
    );
}

export function applyPlaceAliases(
  nodes: RecapBoardNode[],
  aliases: Record<string, string>,
): RecapBoardNode[] {
  return nodes.map((node) => {
    const alias = aliases[placeIdentityFromVisitNodeId(node.id)]?.trim();
    if (!alias) {
      return node;
    }
    return { ...node, label: alias };
  });
}
