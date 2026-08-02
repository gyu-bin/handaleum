import * as Location from 'expo-location';

/**
 * Serial, rate-limited access to CLGeocoder.
 *
 * Apple throttles reverse-geocoding per app. A parallel burst makes it reject
 * calls, and a rejected coordinate used to be dropped for good — that is how a
 * place could go missing while its neighbour resolved fine. One call at a
 * time, spaced, with backoff and retries instead.
 */

const MIN_GAP_MS = 90;
const MAX_BACKOFF_MS = 4000;
const FIRST_BACKOFF_MS = 300;
const ATTEMPTS = 3;

let chain: Promise<unknown> = Promise.resolve();
let backoffMs = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function penalize(): void {
  backoffMs = Math.min(
    MAX_BACKOFF_MS,
    backoffMs === 0 ? FIRST_BACKOFF_MS : backoffMs * 2,
  );
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    await sleep(MIN_GAP_MS + backoffMs);
    return task();
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
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
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<Location.LocationGeocodedAddress | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const results = await enqueue(() =>
        Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }),
      );
      backoffMs = 0;
      if (results.length > 0) {
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
  return null;
}
