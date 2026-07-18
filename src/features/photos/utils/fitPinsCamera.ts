/**
 * Camera (scale + pan) that fits projected pin positions into the viewport,
 * the way map apps frame "this month's places" instead of the whole country.
 */

export interface PinPoint {
  x: number;
  y: number;
}

export interface MapCameraTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface FitPinsOptions {
  width: number;
  height: number;
  /** Absolute min/max scale allowed by the zoom container. */
  minScale: number;
  maxScale: number;
  /** Soft ceiling for the *initial* fit so the user can still pinch in further. */
  maxFitScale: number;
  /** Soft floor so a nationwide spread still gets a gentle nudge in. */
  minFitScale: number;
  /** Extra padding around the pin bbox, in base (unscaled) pixels. */
  padding: number;
  /**
   * Minimum bbox span as a fraction of the viewport — prevents a single pin
   * from slamming to max zoom.
   */
  minSpanFraction: number;
}

const DEFAULTS: Omit<FitPinsOptions, 'width' | 'height'> = {
  minScale: 1,
  maxScale: 8,
  maxFitScale: 3.6,
  minFitScale: 1.35,
  padding: 56,
  minSpanFraction: 0.22,
};

/**
 * Compute a transform that centers the pin bbox and scales to fit (with padding).
 * Empty pins → identity (full Korea).
 */
export function fitPinsCamera(
  pins: PinPoint[],
  width: number,
  height: number,
  options: Partial<FitPinsOptions> = {},
): MapCameraTransform {
  const opts = { ...DEFAULTS, ...options, width, height };

  if (pins.length === 0 || width <= 0 || height <= 0) {
    return { scale: opts.minScale, translateX: 0, translateY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pin of pins) {
    minX = Math.min(minX, pin.x);
    maxX = Math.max(maxX, pin.x);
    minY = Math.min(minY, pin.y);
    maxY = Math.max(maxY, pin.y);
  }

  const minSpanX = width * opts.minSpanFraction;
  const minSpanY = height * opts.minSpanFraction;
  const spanX = Math.max(maxX - minX, minSpanX);
  const spanY = Math.max(maxY - minY, minSpanY);

  const scaleX = width / (spanX + opts.padding * 2);
  const scaleY = height / (spanY + opts.padding * 2);
  let scale = Math.min(scaleX, scaleY);
  scale = Math.min(opts.maxFitScale, Math.max(opts.minFitScale, scale));
  scale = Math.min(opts.maxScale, Math.max(opts.minScale, scale));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // ResumableZoom: screen = center + translate + scale * (base - center)
  let translateX = -scale * (cx - width / 2);
  let translateY = -scale * (cy - height / 2);

  const boundX = Math.max(0, (width * scale - width) / 2);
  const boundY = Math.max(0, (height * scale - height) / 2);
  translateX = Math.max(-boundX, Math.min(boundX, translateX));
  translateY = Math.max(-boundY, Math.min(boundY, translateY));

  return { scale, translateX, translateY };
}
