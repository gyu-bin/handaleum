/**
 * Run: npx tsx src/features/photos/utils/monthEndAt.check.ts
 */
import assert from 'node:assert/strict';

import { MONTH_END_HOUR, nextMonthEndAt } from './monthEndAt';

function at(
  y: number,
  m0: number,
  d: number,
  h: number,
  min = 0,
): Date {
  return new Date(y, m0, d, h, min, 0, 0);
}

function sameLocal(a: Date, b: Date): void {
  assert.equal(a.getFullYear(), b.getFullYear());
  assert.equal(a.getMonth(), b.getMonth());
  assert.equal(a.getDate(), b.getDate());
  assert.equal(a.getHours(), b.getHours());
  assert.equal(a.getMinutes(), b.getMinutes());
}

assert.equal(MONTH_END_HOUR, 21);

sameLocal(nextMonthEndAt(at(2026, 6, 15, 12)), at(2026, 6, 31, 21));
sameLocal(nextMonthEndAt(at(2026, 5, 15, 12)), at(2026, 5, 30, 21));
sameLocal(nextMonthEndAt(at(2025, 1, 1, 9)), at(2025, 1, 28, 21));
sameLocal(nextMonthEndAt(at(2024, 1, 1, 9)), at(2024, 1, 29, 21));
sameLocal(nextMonthEndAt(at(2026, 6, 31, 20, 59)), at(2026, 6, 31, 21));
sameLocal(nextMonthEndAt(at(2026, 6, 31, 21)), at(2026, 7, 31, 21));
sameLocal(nextMonthEndAt(at(2026, 6, 31, 22)), at(2026, 7, 31, 21));
sameLocal(nextMonthEndAt(at(2026, 11, 31, 22)), at(2027, 0, 31, 21));
sameLocal(nextMonthEndAt(at(2026, 0, 31, 22)), at(2026, 1, 28, 21));

console.log('monthEndAt.check: ok');
