/** Lookups per tick before yielding to the UI event loop. */
export const PIP_CHUNK = 32;

/**
 * Walk `items` in chunks so point-in-polygon work cannot freeze the map.
 * ponytail: still JS-thread PIP. Ceiling = PIP_CHUNK lookups/tick; worker if
 * frames still drop on huge albums.
 */
export async function forEachPipChunk<T>(
  items: readonly T[],
  visit: (item: T, index: number) => void,
  chunkSize = PIP_CHUNK,
): Promise<void> {
  const size = Math.max(1, chunkSize);
  for (let i = 0; i < items.length; i += 1) {
    visit(items[i]!, i);
    if ((i + 1) % size === 0 && i + 1 < items.length) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
}
