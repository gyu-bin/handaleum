import { z } from 'zod';

import { monthKeySchema, photoRefSchema } from '../photos/schema';
import { PAPER_SKIN_IDS } from './constants/paperSkins';

export const cardTemplateSchema = z.enum(['feed', 'story']);

export const paperSkinSchema = z.enum(PAPER_SKIN_IDS);

export const commentAlignSchema = z.enum(['left', 'center', 'right']);

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
  /** One-line caption on the card (create UI caps at 40). */
  comment: z.string().max(300),
  /** Selected photos only; originals stay in the camera roll */
  photoRefs: z.array(photoRefSchema).min(1).max(5),
  template: cardTemplateSchema,
  /** Paper background only — photos/layout unchanged. */
  paperSkin: paperSkinSchema.default('ivory'),
  /** One-line comment horizontal alignment. */
  commentAlign: commentAlignSchema.default('left'),
  /** Short 구/시 chips on collage cells. */
  placeOverlay: z.boolean().default(false),
  /** Same order as photoRefs. Empty string = no chip. */
  placeLabels: z.array(z.string()).max(5).optional(),
  mapSnapshot: mapSnapshotSchema,
  createdAt: z.iso.datetime(),
});

/** Editing state before save; id/createdAt are assigned by the storage layer */
export const recapCardDraftSchema = recapCardSchema.omit({
  id: true,
  createdAt: true,
});

/** Recap board cell caption — short enough to sit under a circle. */
export const PLACE_ALIAS_MAX = 16;

/** place identity → user alias. Empty values are dropped on write. */
export const placeAliasesSchema = z.record(
  z.string().min(1),
  z.string().min(1).max(PLACE_ALIAS_MAX),
);
