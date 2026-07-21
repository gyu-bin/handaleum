import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { CardTemplate } from '../types';

/** Instagram-friendly export dimensions, in pixels. */
export const EXPORT_SIZES: Record<CardTemplate, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 }, // 4:5
  story: { width: 1080, height: 1920 }, // 9:16
};

/**
 * Points width to render the off-screen export template at, so a native-scale
 * capture lands at 1080px wide on any density: renderWidth * scale ≈ 1080.
 * Rendering at real size (not upscaling a small preview) is what keeps text and
 * the map crisp — see cards/ARCHITECTURE.md.
 */
export const EXPORT_RENDER_WIDTH = Math.round(1080 / PixelRatio.get());

/**
 * Capture a rendered card view to a temp PNG. `ref` wraps a template rendered
 * at EXPORT_RENDER_WIDTH, so a native-scale capture lands at EXPORT_SIZES
 * (1080-wide) without passing width/height — those options are in POINTS on
 * iOS, so specifying 1080 would re-scale to 1080*density and over-render.
 */
export async function captureCardImage(
  ref: Parameters<typeof captureRef>[0],
): Promise<string> {
  return captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });
}
