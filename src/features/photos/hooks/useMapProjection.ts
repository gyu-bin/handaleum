import { useMemo } from 'react';

import koreaGeo from '@/assets/geo/korea.json';
import municipalitiesGeo from '@/assets/geo/municipalities.json';
import provincesGeo from '@/assets/geo/provinces.json';
import { KOREA_CITIES } from '@/shared/constants/koreaCities';

import type { ProjectedLabel } from '../components/MapSvg';
import type { PlaceCluster } from '../types';
import {
  bboxOf,
  centroidOf,
  createProjection,
  geometryToPath,
  type PackedGeometry,
} from '../utils/geo';

const MAP_PAD = 8;

const FOCUS_BBOX = {
  minLng: 125.75,
  maxLng: 129.6,
  minLat: 33.08,
  maxLat: 38.62,
};

/** Metros covered by city labels — skip as 도. */
const METRO_PROVINCE_NAMES = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '제주',
]);

type ProvinceFeature = PackedGeometry & {
  id: string;
  name: string;
  centroid?: [number, number];
};

type MuniFeature = PackedGeometry & { id: string; name?: string };

export interface MapProjectionResult {
  koreaPath: string;
  provincePaths: { id: string; d: string }[];
  cityPaths: { id: string; d: string }[];
  labels: ProjectedLabel[];
  pinPositions: { cluster: PlaceCluster; x: number; y: number }[];
}

/**
 * Projects Korea geometry + curated name labels + pin anchors.
 * Keeps label set small (도 + curated 시 only) so zoom stays readable.
 */
export function useMapProjection(
  size: { width: number; height: number },
  clusters: PlaceCluster[],
): MapProjectionResult {
  const southKorea = koreaGeo.korea as unknown as PackedGeometry;
  const provinces = provincesGeo.provinces as unknown as ProvinceFeature[];
  const municipalities =
    municipalitiesGeo.municipalities as unknown as MuniFeature[];

  const projection = useMemo(() => {
    if (size.width === 0 || size.height === 0) {
      return null;
    }
    const raw = bboxOf(southKorea);
    const focused = {
      minLng: Math.max(raw.minLng, FOCUS_BBOX.minLng),
      maxLng: Math.min(raw.maxLng, FOCUS_BBOX.maxLng),
      minLat: Math.max(raw.minLat, FOCUS_BBOX.minLat),
      maxLat: Math.min(raw.maxLat, FOCUS_BBOX.maxLat),
    };
    return createProjection(focused, size.width, size.height, MAP_PAD);
  }, [southKorea, size.height, size.width]);

  const koreaPath = useMemo(
    () => (projection ? geometryToPath(southKorea, projection.project) : ''),
    [southKorea, projection],
  );

  const provincePaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    return provinces.map((province) => ({
      id: province.id,
      d: geometryToPath(province, projection.project),
    }));
  }, [provinces, projection]);

  const cityPaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    return municipalities.map((muni) => ({
      id: muni.id,
      d: geometryToPath(muni, projection.project),
    }));
  }, [municipalities, projection]);

  const pinPositions = useMemo(() => {
    if (!projection) {
      return [];
    }
    return clusters.map((cluster) => {
      const [x, y] = projection.project([cluster.centerLng, cluster.centerLat]);
      return { cluster, x, y };
    });
  }, [clusters, projection]);

  const labels = useMemo<ProjectedLabel[]>(() => {
    if (!projection) {
      return [];
    }

    const provinceLabels: ProjectedLabel[] = provinces
      .filter((p) => !METRO_PROVINCE_NAMES.has(p.name))
      .map((province) => {
        const c = province.centroid ?? centroidOf(province);
        const [x, y] = projection.project(c);
        return {
          key: `prov-${province.id}`,
          text: province.name,
          x,
          y,
          tier: 0 as const,
        };
      });

    const cityLabels: ProjectedLabel[] = KOREA_CITIES.map((city, index) => {
      const [x, y] = projection.project(city.c);
      return {
        key: `city-${city.name}-${index}`,
        text: city.name,
        x,
        y,
        tier: city.tier as 1 | 2 | 3,
      };
    });

    return [...provinceLabels, ...cityLabels];
  }, [provinces, projection]);

  return {
    koreaPath,
    provincePaths,
    cityPaths,
    labels,
    pinPositions,
  };
}
