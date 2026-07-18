import { z } from 'zod';

import { monthKeySchema, photoRefSchema } from '../photos/schema';

export const cardTemplateSchema = z.enum(['feed', 'story']);

export const mapSnapshotSchema = z.object({
  minLat: z.number().min(-90).max(90),
  maxLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLng: z.number().min(-180).max(180),
});

export const recapCardSchema = z.object({
  id: z.string().min(1),
  /** YYYY-MM this card looks back on */
  month: monthKeySchema,
  title: z.string().min(1).max(40),
  comment: z.string().max(300),
  /** Selected photos only; originals stay in the camera roll */
  photoRefs: z.array(photoRefSchema).min(1),
  template: cardTemplateSchema,
  mapSnapshot: mapSnapshotSchema,
  createdAt: z.iso.datetime(),
});

/** Editing state before save; id/createdAt are assigned by the storage layer */
export const recapCardDraftSchema = recapCardSchema.omit({
  id: true,
  createdAt: true,
});
