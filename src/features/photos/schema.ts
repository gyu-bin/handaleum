import { z } from 'zod';

/** YYYY-MM */
export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/**
 * Reference to a camera-roll asset. Originals are never copied (spec A-2).
 * lat/lng are required: photos without GPS are excluded entirely and only
 * surfaced as a count (discovery decision, 2026-07-17).
 */
export const photoRefSchema = z.object({
  assetId: z.string().min(1),
  takenAt: z.iso.datetime(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const monthlyPhotosSchema = z.object({
  month: monthKeySchema,
  photos: z.array(photoRefSchema),
  /** Photos in this month that were excluded for having no GPS data */
  noLocationCount: z.number().int().min(0),
});

export const monthSummarySchema = z.object({
  month: monthKeySchema,
  totalCount: z.number().int().min(0),
});

/** Derived at read time only — never persisted (spec A-2) */
export const placeClusterSchema = z.object({
  id: z.string().min(1),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  photos: z.array(photoRefSchema).min(1),
});

/**
 * Paper map palette id (persisted app setting).
 *
 * One palette on purpose — the dawn paper map is the app's identity, not a
 * preference. The id and its plumbing are kept so a future theme pack can add
 * entries here without rewiring. Values persisted by older builds ('ink',
 * 'warm') fail this schema and fall back to the default on read.
 */
export const mapThemeIdSchema = z.enum(['dawn']);

/**
 * Per-place cover photo for a pin.
 * placeKey is a ~110m lat/lng bucket (same as journey geocode), not cluster id —
 * clusters change with zoom.
 */
export const pinCoverSchema = z.object({
  month: monthKeySchema,
  placeKey: z.string().min(1),
  assetId: z.string().min(1),
});

/**
 * Home location (persisted app setting). Photos inside `radiusM` are dropped
 * from every recap surface — map, journey labels, and cards — because the
 * place you sleep is not somewhere you "went" (decision 2026-07-19).
 */
export const homeLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(5000),
});

/** Zoom-scoped visit list admin grain. */
export const visitAdminLevelSchema = z.enum(['province', 'city', 'dong']);

/** Derived from reverse-geocode — never persisted. */
export const visitPlaceSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  level: visitAdminLevelSchema,
  province: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  gu: z.string().min(1).optional(),
  dong: z.string().min(1).optional(),
  firstTakenAt: z.iso.datetime(),
});
