/**
 * Runnable check for card share routing.
 * Run: npx tsx src/features/cards/services/cardShare.check.ts
 */
import assert from 'node:assert/strict';

import { planCardShare } from './cardShare';

const uri = 'file:///tmp/card.png';
const pathOnly = '/data/user/0/com.handaleum.app/cache/card.png';

assert.deepEqual(planCardShare('ios', uri, '칠월'), {
  kind: 'activity',
  url: uri,
  message: '칠월',
});

assert.deepEqual(planCardShare('android', uri, '칠월'), {
  kind: 'file',
  uri,
  mimeType: 'image/png',
});

assert.deepEqual(planCardShare('android', pathOnly), {
  kind: 'file',
  uri: `file://${pathOnly}`,
  mimeType: 'image/png',
});

assert.deepEqual(planCardShare('ios', pathOnly, undefined), {
  kind: 'activity',
  url: `file://${pathOnly}`,
  message: undefined,
});

console.log('ok cardShare');
