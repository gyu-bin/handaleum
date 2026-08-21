import { useEffect, useRef, useState } from 'react';

/**
 * Remaining ms to keep a held busy flag.
 * `null` = hold until busy flips off (no max).
 */
export function holdBusyReleaseInMs(
  elapsedMs: number,
  busy: boolean,
  minMs: number,
  maxMs?: number,
): number | null {
  if (busy) {
    if (maxMs == null) {
      return null;
    }
    return Math.max(0, maxMs - elapsedMs);
  }
  return Math.max(0, minMs - elapsedMs);
}

/**
 * Keep a busy UI visible for at least `minMs` after busy becomes true.
 * If busy never flips on, returns false immediately (no forced wait).
 * Default 1.5s so the bike mark always gets a short, continuous spin.
 * Pass `maxMs` to drop the overlay even if work is still running.
 */
export function useHeldBusy(busy: boolean, minMs = 1500, maxMs?: number): boolean {
  const [held, setHeld] = useState(busy);
  const sinceRef = useRef<number | null>(busy ? Date.now() : null);

  useEffect(() => {
    if (busy) {
      if (sinceRef.current == null) {
        sinceRef.current = Date.now();
      }
      const releaseIn = holdBusyReleaseInMs(
        Date.now() - sinceRef.current,
        true,
        minMs,
        maxMs,
      );
      if (releaseIn === 0) {
        setHeld(false);
        return;
      }
      setHeld(true);
      if (releaseIn == null) {
        return;
      }
      const t = setTimeout(() => {
        setHeld(false);
      }, releaseIn);
      return () => clearTimeout(t);
    }

    const started = sinceRef.current;
    if (started == null) {
      setHeld(false);
      return;
    }

    const remain = holdBusyReleaseInMs(
      Date.now() - started,
      false,
      minMs,
      maxMs,
    );
    if (remain === 0) {
      sinceRef.current = null;
      setHeld(false);
      return;
    }

    const t = setTimeout(() => {
      sinceRef.current = null;
      setHeld(false);
    }, remain ?? 0);
    return () => clearTimeout(t);
  }, [busy, minMs, maxMs]);

  return held;
}
