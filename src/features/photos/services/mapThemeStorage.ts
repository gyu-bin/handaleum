import {
  getMapThemeId,
  setMapThemeId as persistMapThemeId,
} from '@/lib/storage';
import { DEFAULT_MAP_THEME_ID } from '@/shared/constants/mapThemes';

import { mapThemeIdSchema } from '../schema';
import type { MapThemeId } from '../types';

export function readMapThemeId(): MapThemeId {
  const raw = getMapThemeId();
  if (!raw) {
    return DEFAULT_MAP_THEME_ID;
  }
  const parsed = mapThemeIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_MAP_THEME_ID;
}

export function writeMapThemeId(id: MapThemeId): void {
  const parsed = mapThemeIdSchema.parse(id);
  persistMapThemeId(parsed);
}
