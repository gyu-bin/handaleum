import { getPlaceAliasesRaw, setPlaceAliasesRaw } from '@/lib/storage';

import { PLACE_ALIAS_MAX, placeAliasesSchema } from '../schema';

export type PlaceAliases = Record<string, string>;

export function readPlaceAliases(): PlaceAliases {
  const raw = getPlaceAliasesRaw();
  if (!raw) {
    return {};
  }
  try {
    const parsed = placeAliasesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

function persist(next: PlaceAliases): PlaceAliases {
  const parsed = placeAliasesSchema.safeParse(next);
  const clean = parsed.success ? parsed.data : {};
  setPlaceAliasesRaw(JSON.stringify(clean));
  return clean;
}

export function writePlaceAlias(
  identity: string,
  alias: string | null,
  current: PlaceAliases,
): PlaceAliases {
  const key = identity.trim();
  if (!key || key.startsWith('pending:')) {
    return current;
  }
  const next = { ...current };
  const trimmed = alias?.trim() ?? '';
  if (!trimmed) {
    delete next[key];
    return persist(next);
  }
  next[key] = trimmed.slice(0, PLACE_ALIAS_MAX);
  return persist(next);
}
