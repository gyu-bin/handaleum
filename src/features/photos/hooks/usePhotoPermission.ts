import { useCallback, useEffect, useState } from 'react';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
  type PermissionResponse,
} from 'expo-media-library';

export type PhotoPermissionStatus = 'undetermined' | 'granted' | 'limited' | 'denied';

export interface PhotoPermissionState {
  status: PhotoPermissionStatus;
  /** False until the first getPermissionsAsync resolves */
  isReady: boolean;
  request: () => Promise<PhotoPermissionStatus>;
}

function mapPermission(response: PermissionResponse): PhotoPermissionStatus {
  if (response.status === 'undetermined') {
    return 'undetermined';
  }
  if (response.status === 'denied' || !response.granted) {
    return 'denied';
  }
  if (response.accessPrivileges === 'limited') {
    return 'limited';
  }
  return 'granted';
}

export function usePhotoPermission(): PhotoPermissionState {
  const [status, setStatus] = useState<PhotoPermissionStatus>('undetermined');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await getPermissionsAsync();
        if (!cancelled) {
          setStatus(mapPermission(response));
        }
      } catch (error) {
        console.error('getPermissionsAsync failed', error);
        if (!cancelled) {
          setStatus('denied');
        }
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    try {
      const response = await requestPermissionsAsync();
      const next = mapPermission(response);
      setStatus(next);
      return next;
    } catch (error) {
      console.error('requestPermissionsAsync failed', error);
      setStatus('denied');
      return 'denied' as const;
    }
  }, []);

  return { status, isReady, request };
}
