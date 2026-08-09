/**
 * Collapse height math for sticky headers.
 * Run: npx tsx src/shared/hooks/useCollapseOnScroll.check.ts
 */
import assert from 'node:assert/strict';

import { collapseHeight } from './collapseHeight';

assert.equal(collapseHeight(0, 200, 160, 0.5), 200);
assert.equal(collapseHeight(160, 200, 160, 0.5), 100);
assert.equal(collapseHeight(80, 200, 160, 0.5), 150);
assert.equal(collapseHeight(999, 200, 160, 0.5), 100);
assert.equal(collapseHeight(-10, 200, 160, 0.5), 200);
assert.equal(collapseHeight(0, 0, 160, 0.5), 0);

console.log('useCollapseOnScroll.check.ts: ok');
