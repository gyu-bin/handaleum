import { useMemo } from 'react';

import districtsGeo from '@/assets/geo/districts.json';
import koreaGeo from '@/assets/geo/korea.json';
import municipalitiesGeo from '@/assets/geo/municipalities.json';
import provincesGeo from '@/assets/geo/provinces.json';
import {
  KOREA_CITIES,
  shortCityName,
} from '@/shared/constants/koreaCities';

import type { ProjectedLabel } from '../components/MapSvg';
import type { PlaceCluster } from '../types';
import {
  bboxIntersects,
  bboxOf,
  centroidOf,
  createProjection,
  geometryToPath,
  type GeoBBox,
  type PackedGeometry,
  type Projection,
} from '../utils/geo';
import { collideLabels } from '../utils/labelCollision';

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

type DistrictFeature = PackedGeometry & { id: string; name: string };

export interface MapProjectionResult {
  koreaPath: string;
  provincePaths: { id: string; d: string }[];
  cityPaths: { id: string; d: string }[];
  districtPaths: { id: string; d: string }[];
  labels: ProjectedLabel[];
  pinPositions: { cluster: PlaceCluster; x: number; y: number }[];
  projection: Projection | null;
  reference: Projection | null;
}

function inBBox(lng: number, lat: number, box: GeoBBox, pad = 0): boolean {
  return (
    lng >= box.minLng - pad &&
    lng <= box.maxLng + pad &&
    lat >= box.minLat - pad &&
    lat <= box.maxLat + pad
  );
}

/**
 * Projects Korea geometry + name labels + pin anchors.
 *
 * `baseBBox` selects the geographic region the SVG is drawn for: null means
 * the full-Korea reference view; a bbox means a zoom-rebased region.
 * `detail` drives which admin labels are projected (overview stays quiet).
 */
export function useMapProjection(
  size: { width: number; height: number },
  clusters: PlaceCluster[],
  baseBBox: GeoBBox | null,
  detail: 'overview' | 'region' | 'local' = 'overview',
): MapProjectionResult {
  const southKorea = koreaGeo.korea as unknown as PackedGeometry;
  const provinces = provincesGeo.provinces as unknown as ProvinceFeature[];
  const municipalities =
    municipalitiesGeo.municipalities as unknown as MuniFeature[];
  const districts = districtsGeo.districts as unknown as DistrictFeature[];

  const reference = useMemo(() => {
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

  const projection = useMemo(() => {
    if (!reference) {
      return null;
    }
    if (!baseBBox) {
      return reference;
    }
    return createProjection(baseBBox, size.width, size.height, 0);
  }, [reference, baseBBox, size.width, size.height]);

  const koreaPath = useMemo(
    () => (projection ? geometryToPath(southKorea, projection.project) : ''),
    [southKorea, projection],
  );

  const provincePaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    const view = projection.bbox;
    // Overview keeps every 도; zoomed bases only keep what intersects the view.
    const list =
      detail === 'overview'
        ? provinces
        : provinces.filter((province) =>
            bboxIntersects(bboxOf(province), view, 0.4),
          );
    return list.map((province) => ({
      id: province.id,
      d: geometryToPath(province, projection.project),
    }));
  }, [provinces, projection, detail]);

  const cityPaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    const view = projection.bbox;
    const list =
      detail === 'overview'
        ? municipalities
        : municipalities.filter((muni) =>
            bboxIntersects(bboxOf(muni), view, 0.25),
          );
    return list.map((muni) => ({
      id: muni.id,
      d: geometryToPath(muni, projection.project),
    }));
  }, [municipalities, projection, detail]);

  const districtPaths = useMemo(() => {
    if (!projection || detail === 'overview') {
      return [];
    }
    const view = projection.bbox;
    return districts
      .filter((district) => bboxIntersects(bboxOf(district), view, 0.15))
      .map((district) => ({
        id: district.id,
        d: geometryToPath(district, projection.project),
      }));
  }, [districts, projection, detail]);

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
    const box = projection.bbox;
    const out: ProjectedLabel[] = [];

    // 도 — overview + region (hide when local so 시/구 can breathe).
    if (detail !== 'local') {
      for (const province of provinces) {
        if (METRO_PROVINCE_NAMES.has(province.name)) {
          continue;
        }
        const c = province.centroid ?? centroidOf(province);
        if (detail === 'region' && !inBBox(c[0], c[1], box, 0.3)) {
          continue;
        }
        const [x, y] = projection.project(c);
        out.push({
          key: `prov-${province.id}`,
          text: province.name,
          x,
          y,
          tier: 0,
        });
      }
    }

    // Curated hubs — denser tiers only when zoomed. Skip metro hubs at local
    // so 자치구 names own the empty special-city interiors.
    for (const [index, city] of KOREA_CITIES.entries()) {
      if (detail === 'overview' && city.tier > 1) {
        continue;
      }
      if (detail === 'region' && city.tier > 2) {
        continue;
      }
      if (detail === 'local' && METRO_PROVINCE_NAMES.has(city.name)) {
        continue;
      }
      if (!inBBox(city.c[0], city.c[1], box, 0.4)) {
        continue;
      }
      const [x, y] = projection.project(city.c);
      out.push({
        key: `hub-${city.name}-${index}`,
        text: city.name,
        x,
        y,
        tier: city.tier,
      });
    }

    // 시 names from municipality polygons — region/local only.
    if (detail !== 'overview') {
      for (const muni of municipalities) {
        if (!muni.name) {
          continue;
        }
        const c = centroidOf(muni);
        if (!inBBox(c[0], c[1], box, 0.15)) {
          continue;
        }
        const [x, y] = projection.project(c);
        out.push({
          key: `muni-${muni.id}`,
          text: shortCityName(muni.name),
          x,
          y,
          tier: 2,
        });
      }
    }

    // Metro 자치구 names — region/local (collision drops the dense ones).
    if (detail !== 'overview') {
      for (const district of districts) {
        const c = centroidOf(district);
        if (!inBBox(c[0], c[1], box, 0.1)) {
          continue;
        }
        const [x, y] = projection.project(c);
        out.push({
          key: `dist-${district.id}`,
          text: district.name,
          x,
          y,
          tier: 3,
        });
      }
    }

    return collideLabels(out, detail);
  }, [provinces, municipalities, districts, projection, detail]);

  return {
    koreaPath,
    provincePaths,
    cityPaths,
    districtPaths,
    labels,
    pinPositions,
    projection,
    reference,
  };
}
