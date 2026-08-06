import type { z } from 'zod';

import type {
  cardTemplateSchema,
  mapSnapshotSchema,
  paperSkinSchema,
  recapCardDraftSchema,
  recapCardSchema,
} from './schema';

export type CardTemplate = z.infer<typeof cardTemplateSchema>;
export type PaperSkin = z.infer<typeof paperSkinSchema>;
export type MapSnapshot = z.infer<typeof mapSnapshotSchema>;
export type RecapCard = z.infer<typeof recapCardSchema>;
export type RecapCardDraft = z.infer<typeof recapCardDraftSchema>;
