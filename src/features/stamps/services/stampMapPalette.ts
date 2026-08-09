import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';

/** Color-book region id for stamp glance washes + legend. */
export type StampWashRegionId =
  | 'capital'
  | 'gangwon'
  | 'chungcheong'
  | 'jeolla'
  | 'gyeongsang'
  | 'jeju';

type RegionDef = {
  id: StampWashRegionId;
  /** Legend title (mockup wording). */
  label: string;
  fill: string;
  sidos: readonly string[];
};

const REGIONS: readonly RegionDef[] = [
  {
    id: 'capital',
    label: '서울·경기',
    fill: theme.colors.stampWashCapital,
    sidos: ['서울', '인천', '경기'],
  },
  {
    id: 'gangwon',
    label: '강원도',
    fill: theme.colors.stampWashGangwon,
    sidos: ['강원'],
  },
  {
    id: 'chungcheong',
    label: '충청',
    fill: theme.colors.stampWashChungcheong,
    sidos: ['충북', '충남', '대전', '세종'],
  },
  {
    id: 'jeolla',
    label: '전라',
    fill: theme.colors.stampWashJeolla,
    sidos: ['전북', '전남', '광주'],
  },
  {
    id: 'gyeongsang',
    label: '경상',
    fill: theme.colors.stampWashGyeongsang,
    sidos: ['경북', '경남', '부산', '대구', '울산'],
  },
  {
    id: 'jeju',
    label: '제주도',
    fill: theme.colors.stampWashJeju,
    sidos: ['제주'],
  },
] as const;

const SIDO_TO_REGION = new Map<string, RegionDef>();
for (const region of REGIONS) {
  for (const sido of region.sidos) {
    SIDO_TO_REGION.set(sido, region);
  }
}

/** Map label text (readable on nation SVG). */
const SIDO_MAP_LABEL: Record<string, string> = {
  서울: '서울',
  부산: '부산',
  대구: '대구',
  인천: '인천',
  광주: '광주',
  대전: '대전',
  울산: '울산',
  세종: '세종',
  경기: '경기',
  강원: '강원도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전라북도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주도',
};

export function stampMapLabelForSido(sido: string): string {
  return SIDO_MAP_LABEL[sido] ?? sido;
}

export function stampWashRegionForSido(sido: string): RegionDef | null {
  return SIDO_TO_REGION.get(sido) ?? null;
}

/** Soft pastel for a 동 blob (by 시·도 region). */
export function stampBlobFillForSido(sido: string): string {
  return stampWashRegionForSido(sido)?.fill ?? theme.colors.landDeep;
}

/** @deprecated Prefer empty land + dong blobs; kept for any leftover call sites. */
export function stampWashFillForSido(
  sido: string,
  visited: boolean,
): string {
  if (!visited) {
    return theme.colors.landLight;
  }
  return stampBlobFillForSido(sido);
}

export type StampMapLegendRow = {
  id: StampWashRegionId;
  label: string;
  fill: string;
  dongCount: number;
};

/**
 * Legend rows for regions with ≥1 collected 동 (mockup order).
 */
export function stampMapLegendFromCollected(
  collected: StampsCollected,
): StampMapLegendRow[] {
  const counts = new Map<StampWashRegionId, number>();
  for (const entry of Object.values(collected)) {
    const region = stampWashRegionForSido(entry.sido);
    if (!region) {
      continue;
    }
    counts.set(region.id, (counts.get(region.id) ?? 0) + 1);
  }
  const rows: StampMapLegendRow[] = [];
  for (const region of REGIONS) {
    const dongCount = counts.get(region.id) ?? 0;
    if (dongCount === 0) {
      continue;
    }
    rows.push({
      id: region.id,
      label: region.label,
      fill: region.fill,
      dongCount,
    });
  }
  return rows;
}
