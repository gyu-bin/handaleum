import * as Location from 'expo-location';

import { dummyGeocodeNear } from './dummyPhotos';

/**
 * Serial, rate-limited access to CLGeocoder with two priorities.
 *
 * Apple throttles reverse-geocoding per app. A parallel burst makes it reject
 * calls, and a rejected coordinate used to be dropped for good — that is how a
 * place could go missing while its neighbour resolved fine. One call at a
 * time, spaced, with backoff and retries instead.
 *
 * Priorities exist because the full-album stamp scan shares this queue with
 * the month view: interactive requests (chips, pin sheet, playback) always cut
 * ahead of the background scan, and the scan is paced slower so it does not
 * push the geocoder into throttling in the first place.
 */

export type GeocodePriority = 'interactive' | 'background';

const GAP_MS: Record<GeocodePriority, number> = {
  interactive: 90,
  background: 300,
};
const MAX_BACKOFF_MS = 4000;
const FIRST_BACKOFF_MS = 300;
const ATTEMPTS = 3;

type Job = {
  lat: number;
  lng: number;
  priority: GeocodePriority;
  settle: (addr: Location.LocationGeocodedAddress | null) => void;
};

const queues: Record<GeocodePriority, Job[]> = {
  interactive: [],
  background: [],
};
let working = false;
let backoffMs = 0;
let doneCount = 0;
let failCount = 0;

export type GeocodeQueueDebug = {
  interactive: number;
  background: number;
  backoffMs: number;
  done: number;
  failed: number;
};

/** Live queue state for the settings diagnostics panel. */
export function geocodeQueueDebug(): GeocodeQueueDebug {
  return {
    interactive: queues.interactive.length,
    background: queues.background.length,
    backoffMs,
    done: doneCount,
    failed: failCount,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function penalize(): void {
  backoffMs = Math.min(
    MAX_BACKOFF_MS,
    backoffMs === 0 ? FIRST_BACKOFF_MS : backoffMs * 2,
  );
}

async function runJob(job: Job): Promise<Location.LocationGeocodedAddress | null> {
  // Sample pins ship canned iOS-shaped addresses — avoid CLGeocoder entirely.
  const dummy = dummyGeocodeNear(job.lat, job.lng);
  if (dummy) {
    doneCount += 1;
    return dummy;
  }

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(GAP_MS[job.priority] + backoffMs);
    }
    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: job.lat,
        longitude: job.lng,
      });
      backoffMs = 0;
      if (results.length > 0) {
        doneCount += 1;
        return results[0] ?? null;
      }
      // An empty array is what a throttled CLGeocoder returns, so retry it.
      penalize();
    } catch (error) {
      penalize();
      if (attempt === ATTEMPTS - 1) {
        console.warn('reverseGeocode failed', error);
      }
    }
  }
  failCount += 1;
  return null;
}

async function work(): Promise<void> {
  if (working) {
    return;
  }
  working = true;
  try {
    while (true) {
      const job = queues.interactive.shift() ?? queues.background.shift();
      if (!job) {
        return;
      }
      await sleep(GAP_MS[job.priority] + backoffMs);
      job.settle(await runJob(job));
    }
  } finally {
    working = false;
    // A job enqueued between the last shift and the finally would be orphaned.
    if (queues.interactive.length > 0 || queues.background.length > 0) {
      void work();
    }
  }
}

/**
 * Request foreground location if needed (reverse-geocode requires it on iOS).
 */
export async function ensurePlacePermission(
  requestIfNeeded: boolean,
): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') {
      return true;
    }
    if (!requestIfNeeded) {
      return false;
    }
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.status === 'granted';
  } catch (error) {
    console.warn('ensurePlacePermission failed', error);
    return false;
  }
}

/** Queued reverse-geocode. Null only after every attempt failed. */
export function reverseGeocode(
  lat: number,
  lng: number,
  priority: GeocodePriority = 'interactive',
): Promise<Location.LocationGeocodedAddress | null> {
  return new Promise((settle) => {
    queues[priority].push({ lat, lng, priority, settle });
    void work();
  });
}
