import { useEffect, useState } from 'react';

import type { PlaceCluster } from '../types';
import { resolveClusterGuLabel } from '../utils/placeJourney';

export interface ClusterPlaceLabel {
  clusterId: string;
  text: string;
  lat: number;
  lng: number;
}

/**
 * Reverse-geocode cluster centers for on-map 구 stamps when zoomed in.
 * One stamp per 구 (deduped). Cities without a 구 stay silent — 시 labels cover them.
 */
export function useClusterPlaceLabels(
  clusters: PlaceCluster[],
  enabled: boolean,
): ClusterPlaceLabel[] {
  const [labels, setLabels] = useState<ClusterPlaceLabel[]>([]);

  useEffect(() => {
    if (!enabled || clusters.length === 0) {
      setLabels([]);
      return;
    }

    let cancelled = false;
    const targets = clusters.slice(0, 40);

    void (async () => {
      const next: ClusterPlaceLabel[] = [];
      const seenGu = new Set<string>();
      for (const cluster of targets) {
        const gu = await resolveClusterGuLabel(
          cluster.centerLat,
          cluster.centerLng,
        );
        if (cancelled) {
          return;
        }
        if (!gu || seenGu.has(gu)) {
          continue;
        }
        seenGu.add(gu);
        next.push({
          clusterId: cluster.id,
          text: gu,
          lat: cluster.centerLat,
          lng: cluster.centerLng,
        });
      }
      if (!cancelled) {
        setLabels(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clusters, enabled]);

  // Stable empty when disabled — avoid retaining stale labels after zoom-out.
  if (!enabled) {
    return [];
  }
  return labels;
}
