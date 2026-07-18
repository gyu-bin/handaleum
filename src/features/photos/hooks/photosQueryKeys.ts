import type { MonthKey } from '../types';

export const photosQueryKeys = {
  all: ['photos'] as const,
  monthly: (month: MonthKey) => ['photos', 'monthly', month] as const,
  summaries: ['photos', 'summaries'] as const,
};
