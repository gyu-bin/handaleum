/**
 * Collapse height math for sticky headers.
 * Run: npx tsx src/shared/hooks/useCollapseOnScroll.check.ts
 */
import assert from 'node:assert/strict';

import { collapseHeight, collapseTravel } from './collapseHeight';

assert.equal(collapseHeight(0, 200, 160, 0.5), 200);
assert.equal(collapseHeight(160, 200, 160, 0.5), 100);
assert.equal(collapseHeight(80, 200, 160, 0.5), 150);
assert.equal(collapseHeight(999, 200, 160, 0.5), 100);
assert.equal(collapseHeight(-10, 200, 160, 0.5), 200);
assert.equal(collapseHeight(0, 0, 160, 0.5), 0);

assert.equal(collapseTravel(0, 0, -10, 160, 800), 0);
assert.equal(collapseTravel(0, 80, 80, 160, 800), 80);
assert.equal(collapseTravel(80, 160, 80, 160, 800), 160);
assert.equal(collapseTravel(160, 500, -80, 160, 800), 80);
assert.equal(collapseTravel(80, 400, -200, 160, 800), 0);
assert.equal(collapseTravel(0, 200, 200, 160, 800), 160);
assert.equal(collapseTravel(80, 80, 0.2, 160, 800), 80);
assert.equal(collapseTravel(160, 400, -30, 160, 400), 160);
assert.equal(collapseTravel(160, 390, -20, 160, 400), 160);
assert.equal(collapseTravel(160, 300, -80, 160, 400), 80);
assert.equal(collapseTravel(100, 420, 20, 160, 400), 120);

console.log('useCollapseOnScroll.check.ts: ok');
