/**
 * Run: npx tsx src/features/photos/utils/shiftMonthKey.check.ts
 */
import assert from 'node:assert/strict';

import { shiftMonthKey } from './month';

assert.equal(shiftMonthKey('2026-08', -1), '2026-07');
assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
assert.equal(shiftMonthKey('2025-12', 1), '2026-01');
assert.equal(shiftMonthKey('2026-08', 0), '2026-08');

console.log('shiftMonthKey.check: ok');
