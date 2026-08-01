import { z } from 'zod';

import { monthKeySchema } from '@/features/photos/schema';

/** One collected 발도장 entry. Keyed by stampId (`sido/name`) in the map. */
export const stampEntrySchema = z.object({
  /** Display 시군구 label (`gu ?? city`). */
  name: z.string().min(1),
  /** Short 시·도 key matching sigungu-by-sido.json (서울, 경기, …). */
  sido: z.string().min(1),
  firstMonth: monthKeySchema,
});

export const stampsCollectedSchema = z.record(z.string(), stampEntrySchema);

export const stampsUnseenSchema = z.array(z.string().min(1));
