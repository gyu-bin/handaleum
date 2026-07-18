export type LngLat = [number, number];

export interface GeoBBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface Projection {
  project: (lngLat: LngLat) => [number, number];
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

function pointInRing(lng: number, lat: number, ring: LngLat[]): boolean {
  // Ray casting; ring may be closed (first==last) or open.
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]![0];
    const yi = ring[i]![1];
    const xj = ring[j]![0];
    const yj = ring[j]![1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * True if (lng, lat) lies inside the geometry (exterior rings only;
 * holes are ignored — fine for municipality/province labels).
 */
export function pointInGeometry(
  lng: number,
  lat: number,
  geometry: PackedGeometry,
): boolean {
  for (const polygon of geometry.coordinates) {
    const exterior = polygon[0];
    if (!exterior || exterior.length < 3) {
      continue;
    }
    if (pointInRing(lng, lat, exterior)) {
      return true;
    }
  }
  return false;
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
    project: ([lng, lat]) => {
      const x = pad + innerW / 2 + ((lng * Math.PI) / 180 - cx) * scale;
      const y = pad + innerH / 2 - (mercatorY(lat) - cy) * scale;
      return [x, y];
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

/**
 * Smooth Catmull-Rom spline through projected points, as cubic Beziers.
 * Used for the paper-map footpath (time-ordered pin trail).
 */
export function catmullRomPath(points: Array<[number, number]>): string {
  if (points.length < 2) {
    return '';
  }
  if (points.length === 2) {
    const [a, b] = points;
    return `M${a[0].toFixed(2)} ${a[1].toFixed(2)} L${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  }

  const parts: string[] = [
    `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`,
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    parts.push(
      `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`,
    );
  }
  return parts.join(' ');
}


