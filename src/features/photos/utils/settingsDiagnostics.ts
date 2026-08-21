import { strings } from '@/shared/constants/strings';
import { getStampScanDebug } from '@/features/stamps/services/stampBackfill';

import { geocodeQueueDebug } from '../services/geocodeQueue';
import { getVisitResolveDebug } from '../services/placeResolve';

/**
 * One-line snapshot of the geocode queue, this month's place resolve, and the
 * full-album scan. `__DEV__` only — surfaced by the settings dev drawer.
 */
export function diagLine(): string {
  const q = geocodeQueueDebug();
  const month = getVisitResolveDebug();
  const scan = getStampScanDebug();
  const elapsedSec =
    scan.startedAt > 0 ? Math.round((Date.now() - scan.startedAt) / 1000) : 0;
  const monthPart = !month
    ? strings.settings.diag.monthIdle
    : strings.settings.diag.month(
        month.resolvedBuckets,
        month.cachedBuckets,
        month.totalBuckets,
        month.failedBuckets,
        month.finished,
      );
  const scanPart =
    scan.phase === 'idle'
      ? strings.settings.diag.scanIdle
      : scan.phase === 'gps'
        ? strings.settings.diag.scanGps(elapsedSec)
        : scan.phase === 'geocode'
          ? strings.settings.diag.scanGeocode(
              scan.chunkDone,
              scan.chunkTotal,
              elapsedSec,
            )
          : strings.settings.diag.scanDone;
  return [
    strings.settings.diag.queue(
      q.interactive,
      q.background,
      q.backoffMs,
      q.done,
      q.failed,
    ),
    monthPart,
    scanPart,
  ].join(' · ');
}
