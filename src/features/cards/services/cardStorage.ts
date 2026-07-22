import { storage } from '@/lib/storage';

import { recapCardSchema } from '../schema';
import type { RecapCard, RecapCardDraft } from '../types';

const CARDS_KEY = 'recapCards';

function readAll(): RecapCard[] {
  const raw = storage.getString(CARDS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      const result = recapCardSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch (error) {
    console.error('Failed to parse recap cards', error);
    return [];
  }
}

function writeAll(cards: RecapCard[]): void {
  storage.set(CARDS_KEY, JSON.stringify(cards));
}

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Local kv-store CRUD. Async signatures so TanStack Query treats it
 * like any other data source. Cards must be readable offline.
 */
export async function listCards(): Promise<RecapCard[]> {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCard(id: string): Promise<RecapCard | null> {
  return readAll().find((card) => card.id === id) ?? null;
}

export async function saveCard(draft: RecapCardDraft): Promise<RecapCard> {
  const card: RecapCard = {
    ...draft,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  const validated = recapCardSchema.parse(card);
  const next = [validated, ...readAll().filter((c) => c.id !== validated.id)];
  writeAll(next);
  return validated;
}

/** Edit an existing card's text. Other fields (photos, map, template) are fixed. */
export async function updateCard(
  id: string,
  fields: Pick<RecapCardDraft, 'title' | 'comment'>,
): Promise<RecapCard> {
  const cards = readAll();
  const index = cards.findIndex((card) => card.id === id);
  if (index === -1) {
    throw new Error(`Card not found: ${id}`);
  }
  const updated = recapCardSchema.parse({ ...cards[index], ...fields });
  cards[index] = updated;
  writeAll(cards);
  return updated;
}

export async function deleteCard(id: string): Promise<void> {
  writeAll(readAll().filter((card) => card.id !== id));
}
