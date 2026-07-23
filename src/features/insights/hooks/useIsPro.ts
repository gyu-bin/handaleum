import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { CustomerInfoUpdateListener } from 'react-native-purchases';

import { IS_MONETIZATION_LIVE } from '@/shared/constants/pricing';
import {
  configurePurchases,
  customerHasPro,
  fetchCustomerHasPro,
  isPurchasesConfigured,
  isUserCancelledPurchase,
  purchasePro,
  Purchases,
  restorePro,
} from '@/lib/purchases';
import { readIsPro, writeIsPro } from '../services/placeFirstSeenStorage';

let cache: boolean | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  if (!IS_MONETIZATION_LIVE) {
    return true;
  }
  if (cache === undefined) {
    // Offline / before first RC sync — last known unlock.
    cache = readIsPro();
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(next: boolean) {
  cache = next;
  writeIsPro(next);
  listeners.forEach((l) => l());
}

/**
 * Pro entitlement from RevenueCat (cached locally for offline).
 * While monetization is off, always true.
 */
export function useIsPro(): {
  isPro: boolean;
  isBusy: boolean;
  error: string | null;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const isPro = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_MONETIZATION_LIVE) {
      return;
    }
    configurePurchases();
    if (!isPurchasesConfigured()) {
      return;
    }

    let cancelled = false;
    void fetchCustomerHasPro()
      .then((next) => {
        if (!cancelled) {
          emit(next);
        }
      })
      .catch((err) => {
        console.error('getCustomerInfo failed', err);
      });

    const onCustomerInfo: CustomerInfoUpdateListener = (info) => {
      emit(customerHasPro(info));
    };
    Purchases.addCustomerInfoUpdateListener(onCustomerInfo);

    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfo);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!IS_MONETIZATION_LIVE || !isPurchasesConfigured()) {
      return;
    }
    const next = await fetchCustomerHasPro();
    emit(next);
  }, []);

  const purchase = useCallback(async () => {
    if (!IS_MONETIZATION_LIVE) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      configurePurchases();
      const next = await purchasePro();
      emit(next);
      if (!next) {
        setError(
          '구매는 됐지만 프로 권한이 확인되지 않았어요. Entitlement(Handaleum Pro) 연결을 확인해 주세요.',
        );
      }
    } catch (err) {
      if (!isUserCancelledPurchase(err)) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: unknown }).message)
            : '구매에 실패했습니다';
        setError(message);
        console.error('purchasePro failed', err);
      }
    } finally {
      setIsBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    if (!IS_MONETIZATION_LIVE) {
      return;
    }
    setError(null);
    setIsBusy(true);
    try {
      configurePurchases();
      const next = await restorePro();
      emit(next);
      if (!next) {
        setError('복원할 구매 내역이 없습니다');
      }
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : '복원에 실패했습니다';
      setError(message);
      console.error('restorePro failed', err);
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { isPro, isBusy, error, purchase, restore, refresh };
}
