/**
 * Month thumb prewarm plan.
 * Run: npx tsx src/features/photos/services/monthImageWarmup.check.ts
 */
import assert from 'node:assert/strict';

import { planMonthPrewarmIds } from './monthPrewarmPlan';

const plan = planMonthPrewarmIds(
  ['a', 'b', 'a'],
  ['a', 'c', 'd', 'e', 'f'],
  2,
);
assert.deepEqual(plan.priority, ['a', 'b']);
assert.deepEqual(plan.fill, ['c', 'd']);

console.log('monthImageWarmup.check.ts: ok');
