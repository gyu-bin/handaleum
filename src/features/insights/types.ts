import type {
  BusiestDay,
  FarthestCandidate,
  InsightsMetrics,
  TopPlaceCandidate,
} from './services/computeInsights';

export type { BusiestDay, FarthestCandidate, InsightsMetrics, TopPlaceCandidate };

export type LabeledFarthest = FarthestCandidate & {
  label: string | null;
  distanceKm: number;
};

export type LabeledTopPlace = TopPlaceCandidate & {
  label: string | null;
};

/** Fully assembled insight payload for the screen. */
export type MonthlyInsights = InsightsMetrics & {
  farthestLabeled: LabeledFarthest | null;
  topPlaceLabeled: LabeledTopPlace | null;
};
