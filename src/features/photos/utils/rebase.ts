import {
  expandBBoxProjected,
  projectedSpans,
  type GeoBBox,
  type Projection,
} from './geo';

import type { MapCameraTransform } from './fitPinsCamera';

/** Visible rect in base-layout pixels, as returned by ResumableZoom.getVisibleRect(). */
export interface VisibleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Outcome of a settle:
 * - `region`    — re-project onto `bbox` and put the camera at the headroom
 *                 scale. The swap reproduces the current screen exactly.
 * - `reference` — the view zoomed out far enough that the region would cover
 *                 the whole reference (full-Korea) base; go back to it, with a
 *                 camera that reproduces the current screen.
 */
export type RebaseResult =
  | { type: 'region'; bbox: GeoBBox; camera: MapCameraTransform }
  | { type: 'reference'; camera: MapCameraTransform };

export interface ComputeRebaseArgs {
  /** What is on screen right now, in the current base's layout pixels. */
  visibleRect: VisibleRect;
  /** Projection the current base SVG was drawn with. */
  projection: Projection;
  /** Full-Korea projection — the outermost base the map ever uses. */
  reference: Projection;
  viewport: { width: number; height: number };
  /**
   * Zoom-out allowance baked into the new base: the visible region is expanded
   * this many times, and the camera sits at this scale after the swap, so the
   * user can still pinch out (camera floor is 1) without an immediate rebase.
   */
  headroom: number;
}

/**
 * Visible rect a camera would produce, mirroring ResumableZoom.getVisibleRect
 * for the child == container == viewport case. Lets month framing rebase from
 * a computed camera without round-tripping through the zoom component.
 */
export function visibleRectForCamera(
  camera: MapCameraTransform,
  viewport: { width: number; height: number },
): VisibleRect {
  const { width: w, height: h } = viewport;
  const s = camera.scale;
  const offX = Math.max((w * s - w) / 2, 0);
  const offY = Math.max((h * s - h) / 2, 0);
  return {
    x: w * ((-camera.translateX + offX) / (w * s)),
    y: h * ((-camera.translateY + offY) / (h * s)),
    width: w * Math.min(1, 1 / s),
    height: h * Math.min(1, 1 / s),
  };
}

/**
 * Pure math for the settle-time rebase.
 *
 * Why the swap is exact: Mercator is affine in (lng-radians, mercator-y)
 * space, and the camera is affine in pixels, so camera∘projection is itself a
 * Mercator fit. Re-fitting the visible region (expanded symmetrically, pad 0,
 * aspect preserved) reproduces that composite map identically — the old view
 * at its settled camera and the new base at the headroom camera paint the same
 * pixels, which is what makes the swap invisible.
 */
export function computeRebase(args: ComputeRebaseArgs): RebaseResult {
  const { visibleRect: r, projection, reference, viewport, headroom } = args;

  // Visible geo region — exact inverse image of the viewport.
  const [lngW, latN] = projection.unproject([r.x, r.y]);
  const [lngE, latS] = projection.unproject([r.x + r.width, r.y + r.height]);
  const visible: GeoBBox = {
    minLng: lngW,
    maxLng: lngE,
    minLat: latS,
    maxLat: latN,
  };

  const expanded = expandBBoxProjected(visible, headroom);

  const spanExpanded = projectedSpans(expanded);
  const spanReference = projectedSpans(reference.bbox);
  if (spanExpanded.x >= spanReference.x || spanExpanded.y >= spanReference.y) {
    // Zoomed out to (or beyond) the reference — reproduce this screen inside
    // the reference base instead of growing bases without bound.
    const spanVisibleX = r.width / projection.coeff;
    const compositeCoeff = viewport.width / spanVisibleX;
    const scale = Math.max(1, compositeCoeff / reference.coeff);
    const center = projection.unproject([r.x + r.width / 2, r.y + r.height / 2]);
    const [cx, cy] = reference.project(center);
    return {
      type: 'reference',
      camera: {
        scale,
        // ResumableZoom model: screen = center + translate + scale*(base - center)
        translateX: -scale * (cx - viewport.width / 2),
        translateY: -scale * (cy - viewport.height / 2),
      },
    };
  }

  return {
    type: 'region',
    bbox: expanded,
    camera: { scale: headroom, translateX: 0, translateY: 0 },
  };
}