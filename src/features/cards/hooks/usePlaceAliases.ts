import { useCallback, useSyncExternalStore } from 'react';

import {
  readPlaceAliases,
  writePlaceAlias,
  type PlaceAliases,
} from '../services/placeAliasStorage';

let cache: PlaceAliases | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): PlaceAliases {
  if (cache === undefined) {
    cache = readPlaceAliases();
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: PlaceAliases): void {
  cache = next;
  for (const listener of listeners) {
    listener();
  }
}

/** User aliases for recap-board place cells. Keyed by admin place identity. */
export function usePlaceAliases(): {
  aliases: PlaceAliases;
  setAlias: (identity: string, alias: string | null) => void;
} {
  const aliases = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setAlias = useCallback((identity: string, alias: string | null) => {
    emit(writePlaceAlias(identity, alias, getSnapshot()));
  }, []);

  return { aliases, setAlias };
}
