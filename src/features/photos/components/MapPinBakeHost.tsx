import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { theme } from '@/shared/constants/theme';

import {
  completePinBake,
  getActivePinBakeJob,
  subscribePinBake,
} from '../services/mapPinBake';

const BORDER = 2.5;
const RADIUS = 8;
const CARET_W = 12;
const CARET_H = 8;
/** Let Image paint into the layer before view-shot. */
const CAPTURE_SETTLE_MS = 80;

/**
 * Off-screen host (outside NaverMapView). Bakes one framed pin PNG at a time
 * so markers can use native `image.httpUri` with paper-pin chrome.
 */
export function MapPinBakeHost() {
  const job = useSyncExternalStore(subscribePinBake, getActivePinBakeJob, () => null);
  const ref = useRef<View>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const jobKey = job?.key ?? '';

  useEffect(() => {
    setPhotoReady(false);
  }, [jobKey]);

  useEffect(() => {
    if (!job || !photoReady) {
      return;
    }
    let cancelled = false;
    let completed = false;
    // Always release the module queue — cancelled captures must not leave `active` stuck.
    const finish = (uri: string | null) => {
      if (completed) {
        return;
      }
      completed = true;
      completePinBake(uri);
    };
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
    }, CAPTURE_SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      finish(null);
    };
  }, [job, photoReady]);

  if (!job) {
    return null;
  }

  const cardSize = job.cardSize;
  const frame = job.selected ? theme.colors.accent : theme.colors.background;
  const tip = job.selected ? theme.colors.accent : theme.colors.ink;
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
            source={{ uri: job.photoUri }}
            style={{ width: cardSize, height: cardSize }}
            resizeMode="cover"
            onLoad={() => setPhotoReady(true)}
            onError={() => {
              // Still try capture (placeholder bg) so the queue doesn't stall.
              setPhotoReady(true);
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
});
