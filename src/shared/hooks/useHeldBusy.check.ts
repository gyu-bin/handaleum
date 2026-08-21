/**
 * Run: npx tsx src/shared/hooks/useHeldBusy.check.ts
 */
import assert from 'node:assert/strict';

import { holdBusyReleaseInMs } from './useHeldBusy';

assert.equal(holdBusyReleaseInMs(0, true, 1500), null);
assert.equal(holdBusyReleaseInMs(0, true, 1500, 2000), 2000);
assert.equal(holdBusyReleaseInMs(2000, true, 1500, 2000), 0);
assert.equal(holdBusyReleaseInMs(2500, true, 1500, 2000), 0);
assert.equal(holdBusyReleaseInMs(0, false, 1500, 2000), 1500);
assert.equal(holdBusyReleaseInMs(400, false, 1500, 2000), 1100);
assert.equal(holdBusyReleaseInMs(1500, false, 1500, 2000), 0);

console.log('useHeldBusy.check: ok');
