import { useEffect, useRef, useState } from 'react';

/**
 * Keep a busy UI visible for at least `minMs` after busy becomes true.
 * If busy never flips on, returns false immediately (no forced wait).
 */
export function useHeldBusy(busy: boolean, minMs = 2500): boolean {
  const [held, setHeld] = useState(busy);
  const sinceRef = useRef<number | null>(busy ? Date.now() : null);

  useEffect(() => {
    if (busy) {
      if (sinceRef.current == null) {
        sinceRef.current = Date.now();
      }
      setHeld(true);
      return;
    }

    const started = sinceRef.current;
    if (started == null) {
      setHeld(false);
      return;
    }

    const remain = minMs - (Date.now() - started);
    if (remain <= 0) {
      sinceRef.current = null;
      setHeld(false);
      return;
    }

    const t = setTimeout(() => {
      sinceRef.current = null;
      setHeld(false);
    }, remain);
    return () => clearTimeout(t);
  }, [busy, minMs]);

  return held;
}
