/**
 * Runnable check for chunked PIP yield.
 * Run: npx tsx src/features/stamps/services/pipChunk.check.ts
 */
import assert from 'node:assert/strict';

import { forEachPipChunk } from './pipChunk';

async function main(): Promise<void> {
  const seen: number[] = [];
  await forEachPipChunk([1, 2, 3, 4, 5], (n) => {
    seen.push(n);
  }, 2);
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);

  const empty: number[] = [];
  await forEachPipChunk([], (n: number) => {
    empty.push(n);
  });
  assert.equal(empty.length, 0);

  const once: string[] = [];
  await forEachPipChunk(['a'], (n) => {
    once.push(n);
  }, 1);
  assert.deepEqual(once, ['a']);

  console.log('pipChunk.check.ts: ok');
}

void main();
