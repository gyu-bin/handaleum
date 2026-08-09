/**
 * Concurrency limiter queue cap.
 * Run: npx tsx src/shared/utils/concurrency.check.ts
 */
import assert from 'node:assert/strict';

import {
  ConcurrencyQueueOverflowError,
  createConcurrencyLimiter,
} from './concurrency';

async function main() {
  const limit = createConcurrencyLimiter(1, {
    maxQueue: 1,
    onOverflow: 'drop-newest',
  });

  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });

  const first = limit(() => gate.then(() => 'a'));
  const second = limit(() => Promise.resolve('b'));
  let overflowed = false;
  try {
    await limit(() => Promise.resolve('c'));
  } catch (error) {
    overflowed = error instanceof ConcurrencyQueueOverflowError;
  }
  assert.equal(overflowed, true, 'third task should overflow');

  release();
  assert.equal(await first, 'a');
  assert.equal(await second, 'b');

  console.log('concurrency.check.ts: ok');
}

void main();
