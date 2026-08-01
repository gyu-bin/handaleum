import type { z } from 'zod';

import type {
  stampEntrySchema,
  stampsCollectedSchema,
  stampsUnseenSchema,
} from './schema';

export type StampEntry = z.infer<typeof stampEntrySchema>;
export type StampsCollected = z.infer<typeof stampsCollectedSchema>;
export type StampsUnseen = z.infer<typeof stampsUnseenSchema>;
