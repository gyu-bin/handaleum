import type { z } from 'zod';

import type {
  cardTemplateSchema,
  mapSnapshotSchema,
  recapCardDraftSchema,
  recapCardSchema,
} from './schema';

export type CardTemplate = z.infer<typeof cardTemplateSchema>;
export type MapSnapshot = z.infer<typeof mapSnapshotSchema>;
export type RecapCard = z.infer<typeof recapCardSchema>;
export type RecapCardDraft = z.infer<typeof recapCardDraftSchema>;
