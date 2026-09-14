import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { theme } from '@/shared/constants/theme';

import {
  completePinBake,
  deferActivePinBake,
  getActivePinBakeJob,
  subscribePinBake,
} from '../services/mapPinBake';

const BORDER = 2;
const RADIUS = 9;
const CARET_W = 10;
const CARET_H = 6;
/** Let Image paint into the layer before view-shot. */
const CAPTURE_SETTLE_MS = 50;
const DOT_SETTLE_MS = 24;

/**
 * Off-screen host (outside NaverMapView). Bakes one framed pin PNG at a time
 * so markers can use native `image.httpUri` with paper-pin chrome.
 */
export function MapPinBakeHost() {
  const job = useSyncExternalStore(subscribePinBake, getActivePinBakeJob, () => null);
  const ref = useRef<View>(null);
  /** Only true when Image finished loading *this* job's photoUri (or dot ready). */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const jobKey = job?.key ?? '';
  const photoReady = job != null && loadedKey === job.key;

  useEffect(() => {
    if (!job) {
      return;
    }
    if (job.kind === 'dot') {
      setLoadedKey(job.key);
    }
  }, [job]);

  useEffect(() => {
    if (!job || !photoReady) {
      return;
    }
    let cancelled = false;
    let completed = false;
    const finish = (uri: string | null) => {
      if (completed) {
        return;
      }
      completed = true;
      completePinBake(uri);
    };
    const settle = job.kind === 'dot' ? DOT_SETTLE_MS : CAPTURE_SETTLE_MS;
    const timer = setTimeout(() => {
      if (cancelled) {
        return;
      }
      if (!ref.current) {
        finish(null);
        return;
      }
      void captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      })
        .then((uri) => {
          if (!cancelled) {
            finish(uri);
          }
        })
        .catch((error) => {
          console.warn('map pin bake failed', error);
          if (!cancelled) {
            finish(null);
          }
        });
    }, settle);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Never resolve null on teardown — that painted gray pins. Re-queue.
      if (!completed) {
        deferActivePinBake();
      }
    };
  }, [job, photoReady]);

  if (!job) {
    return null;
  }

  const cardSize = job.cardSize;
  const selected = job.selected;

  if (job.kind === 'dot') {
    const diameter = cardSize;
    const ring = selected ? theme.colors.point : theme.colors.subtle;
    return (
      <View style={styles.host} pointerEvents="none">
        <View
          ref={ref}
          collapsable={false}
          style={{
            width: diameter,
            height: diameter,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={[
              styles.dot,
              {
                width: diameter,
                height: diameter,
                borderRadius: diameter / 2,
                borderColor: ring,
                borderWidth: selected ? 2.5 : 2,
                backgroundColor: theme.colors.splashMark,
              },
            ]}
          >
            <Text style={styles.dotCount} numberOfLines={1}>
              {job.count > 99 ? '99+' : String(job.count)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const frame = selected ? theme.colors.splashMark : theme.colors.surface;
  const tip = selected ? theme.colors.splashMark : theme.colors.surface;
  const outerW = cardSize + BORDER * 2;
  const outerH = outerW + CARET_H;

  return (
    <View style={styles.host} pointerEvents="none">
      <View
        ref={ref}
        collapsable={false}
        style={{ width: outerW, height: outerH, alignItems: 'center' }}
      >
        <View
          style={[
            styles.card,
            {
              width: outerW,
              height: outerW,
              borderRadius: RADIUS,
              borderColor: frame,
              borderWidth: BORDER,
            },
          ]}
        >
          <Image
            key={jobKey}
            source={{ uri: job.photoUri }}
            style={{ width: cardSize, height: cardSize }}
            resizeMode="cover"
            onLoad={() => setLoadedKey(job.key)}
            onError={() => {
              // Still try capture (placeholder bg) so the queue doesn't stall.
              setLoadedKey(job.key);
            }}
          />
        </View>
        <View
          style={[
            styles.caret,
            {
              borderLeftWidth: CARET_W / 2,
              borderRightWidth: CARET_W / 2,
              borderTopWidth: CARET_H,
              borderTopColor: tip,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: -10000,
    top: 0,
    opacity: 1,
  },
  card: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  caret: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCount: {
    color: theme.colors.surface,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
});
