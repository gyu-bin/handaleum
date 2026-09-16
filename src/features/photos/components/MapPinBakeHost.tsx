import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { theme } from '@/shared/constants/theme';

import {
  completePinBake,
  deferActivePinBake,
  getActivePinBakeJob,
  subscribePinBake,
} from '../services/mapPinBake';

/** Logical (dp) chrome — scaled by PixelRatio when laying out the bake view. */
const BORDER_DP = 2;
const RADIUS_DP = 9;
const CARET_W_DP = 10;
const CARET_H_DP = 6;
/** Let Image paint into the layer before view-shot. */
const CAPTURE_SETTLE_MS = 80;
const DOT_SETTLE_MS = 24;

/**
 * Off-screen host (outside NaverMapView). Bakes one framed pin PNG at a time
 * so markers can use native `image.httpUri` with paper-pin chrome.
 *
 * Layout is in *device pixels as dp numbers* (cardSize × PixelRatio) so the
 * captured PNG is dense enough for Naver markers sized in logical dp. Capturing
 * a 48dp view and only upscaling the bitmap left pins soft on @2x/@3x.
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
      // Capture the laid-out pixel buffer as-is (already @ PixelRatio).
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

  const scale = PixelRatio.get();
  const cardSize = Math.max(1, Math.round(job.cardSize * scale));
  const border = Math.max(1, Math.round(BORDER_DP * scale));
  const radius = Math.max(1, Math.round(RADIUS_DP * scale));
  const caretW = Math.max(2, Math.round(CARET_W_DP * scale));
  const caretH = Math.max(2, Math.round(CARET_H_DP * scale));
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
                borderWidth: selected ? Math.max(2, Math.round(2.5 * scale)) : border,
                backgroundColor: theme.colors.splashMark,
              },
            ]}
          >
            <Text
              style={[
                styles.dotCount,
                { fontSize: Math.round(13 * scale), lineHeight: Math.round(16 * scale) },
              ]}
              numberOfLines={1}
            >
              {job.count > 99 ? '99+' : String(job.count)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const frame = selected ? theme.colors.splashMark : theme.colors.surface;
  const tip = selected ? theme.colors.splashMark : theme.colors.surface;
  const outerW = cardSize + border * 2;
  const outerH = outerW + caretH;

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
              borderRadius: radius,
              borderColor: frame,
              borderWidth: border,
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
              borderLeftWidth: caretW / 2,
              borderRightWidth: caretW / 2,
              borderTopWidth: caretH,
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
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
