import type { z } from 'zod';

import type {
  mapThemeIdSchema,
  monthKeySchema,
  monthlyPhotosSchema,
  monthSummarySchema,
  photoRefSchema,
  pinCoverSchema,
  placeClusterSchema,
  visitAdminLevelSchema,
  visitPlaceSchema,
} from './schema';

export type MonthKey = z.infer<typeof monthKeySchema>;
export type PhotoRef = z.infer<typeof photoRefSchema>;
export type MonthlyPhotos = z.infer<typeof monthlyPhotosSchema>;
export type MonthSummary = z.infer<typeof monthSummarySchema>;
export type PlaceCluster = z.infer<typeof placeClusterSchema>;
export type MapThemeId = z.infer<typeof mapThemeIdSchema>;
export type PinCover = z.infer<typeof pinCoverSchema>;
export type VisitAdminLevel = z.infer<typeof visitAdminLevelSchema>;
export type VisitPlace = z.infer<typeof visitPlaceSchema>;
