export type LngLat = [number, number];

export interface GeoBBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface Projection {
  project: (lngLat: LngLat) => [number, number];
  /** Exact inverse of project — pixel back to lng/lat. */
  unproject: (xy: [number, number]) => LngLat;
  /**
   * Fit coefficient: pixels per projected radian, uniform on both axes.
   * The ratio of two projections' coeffs is their relative magnification —
   * the map rebase math and the effective-zoom report both build on it.
   */
  coeff: number;
  bbox: GeoBBox;
}

type Ring = LngLat[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

export interface PackedGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: MultiPolygon;
}

function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/** Inverse of mercatorY — projected y (radians) back to latitude in degrees. */
function latFromMercatorY(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

/** BBox spans in projected units (lng radians x, mercator y). */
export function projectedSpans(bbox: GeoBBox): { x: number; y: number } {
  return {
    x: ((bbox.maxLng - bbox.minLng) * Math.PI) / 180,
    y: mercatorY(bbox.maxLat) - mercatorY(bbox.minLat),
  };
}

/**
 * Expand a bbox symmetrically about its center in PROJECTED space.
 * Working in projected units (not degrees) keeps the expanded bbox's
 * pixel-space aspect identical to the original — the exactness of the
 * zoom rebase depends on this.
 */
export function expandBBoxProjected(bbox: GeoBBox, factor: number): GeoBBox {
  const x0 = (bbox.minLng * Math.PI) / 180;
  const x1 = (bbox.maxLng * Math.PI) / 180;
  const y0 = mercatorY(bbox.minLat);
  const y1 = mercatorY(bbox.maxLat);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = ((x1 - x0) / 2) * factor;
  const hy = ((y1 - y0) / 2) * factor;
  return {
    minLng: ((cx - hx) * 180) / Math.PI,
    maxLng: ((cx + hx) * 180) / Math.PI,
    minLat: latFromMercatorY(cy - hy),
    maxLat: latFromMercatorY(cy + hy),
  };
}

export function bboxOf(geometry: PackedGeometry): GeoBBox {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }
  return { minLng, maxLng, minLat, maxLat };
}

/** Rough label anchor — bbox center of a polygon geometry. */
export function centroidOf(geometry: PackedGeometry): LngLat {
  const b = bboxOf(geometry);
  return [(b.minLng + b.maxLng) / 2, (b.minLat + b.maxLat) / 2];
}

/** Fit a lon/lat bbox into a pixel viewport (Web Mercator, radians). */
export function createProjection(
  bbox: GeoBBox,
  width: number,
  height: number,
  pad = 36,
): Projection {
  // Both axes must use the same projected units. Longitude in degrees and
  // mercatorY (radians) cannot share one scale — that flattens Korea into a line.
  const x0 = (bbox.minLng * Math.PI) / 180;
  const x1 = (bbox.maxLng * Math.PI) / 180;
  const y0 = mercatorY(bbox.minLat);
  const y1 = mercatorY(bbox.maxLat);
  const innerW = Math.max(1, width - pad * 2);
  const innerH = Math.max(1, height - pad * 2);
  const scale = Math.min(
    innerW / Math.max(1e-9, x1 - x0),
    innerH / Math.max(1e-9, y1 - y0),
  );
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  return {
    bbox,
    coeff: scale,
    project: ([lng, lat]) => {
      const x = pad + innerW / 2 + ((lng * Math.PI) / 180 - cx) * scale;
      const y = pad + innerH / 2 - (mercatorY(lat) - cy) * scale;
      return [x, y];
    },
    unproject: ([x, y]) => {
      const radLng = cx + (x - pad - innerW / 2) / scale;
      const my = cy + (pad + innerH / 2 - y) / scale;
      return [(radLng * 180) / Math.PI, latFromMercatorY(my)];
    },
  };
}

export function geometryToPath(
  geometry: PackedGeometry,
  project: (lngLat: LngLat) => [number, number],
): string {
  const parts: string[] = [];
  for (const polygon of geometry.coordinates) {
    for (const ring of polygon) {
      if (ring.length === 0) {
        continue;
      }
      ring.forEach(([lng, lat], index) => {
        const [x, y] = project([lng, lat]);
        parts.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
      });
      parts.push('Z');
    }
  }
  return parts.join(' ');
}


