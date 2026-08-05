import { z } from 'zod';

import { monthKeySchema } from '@/features/photos/schema';

/** One collected 발도장 entry. Keyed by stampId (`sido/city/dong`). */
export const stampEntrySchema = z.object({
  /** Display 동 label. */
  name: z.string().min(1),
  /** Parent 시 (서울, 수원시, …). */
  city: z.string().min(1),
  /** Short 시·도 key (서울, 경기, …). */
  sido: z.string().min(1),
  firstMonth: monthKeySchema,
});

export const stampsCollectedSchema = z.record(z.string(), stampEntrySchema);

export const stampsUnseenSchema = z.array(z.string().min(1));
