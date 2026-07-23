import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import {
  IS_MONETIZATION_LIVE,
  PRO_ENTITLEMENT_ID,
  PRO_PRODUCT_ID,
} from '@/shared/constants/pricing';

let configured = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

/** Call once at app start. No-ops when monetization is off or key missing. */
export function configurePurchases(): void {
  if (configured || !IS_MONETIZATION_LIVE) {
    return;
  }

  const apiKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_KEY?.trim()
      : process.env.EXPO_PUBLIC_RC_ANDROID_KEY?.trim();

  if (!apiKey) {
    console.warn(
      '[purchases] EXPO_PUBLIC_RC_IOS_KEY / ANDROID_KEY missing — IAP disabled',
    );
    return;
  }

  // Test Store keys work in Expo Go; App Store keys need a native build.
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO);
  Purchases.configure({ apiKey });
  configured = true;
}

export function customerHasPro(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]);
}

export async function fetchCustomerHasPro(): Promise<boolean> {
  if (!configured) {
    return !IS_MONETIZATION_LIVE;
  }
  const info = await Purchases.getCustomerInfo();
  return customerHasPro(info);
}

function pickProPackage(
  packages: PurchasesPackage[],
): PurchasesPackage | undefined {
  return (
    packages.find((pkg) => pkg.product.identifier === PRO_PRODUCT_ID) ??
    packages.find((pkg) => pkg.identifier === PRO_PRODUCT_ID) ??
    packages[0]
  );
}

export async function purchasePro(): Promise<boolean> {
  if (!configured) {
    throw new Error('Purchases not configured');
  }
  const offerings = await Purchases.getOfferings();
  const pkg = pickProPackage(offerings.current?.availablePackages ?? []);
  if (!pkg) {
    throw new Error('No pro package in current offering');
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerHasPro(customerInfo);
}

export async function restorePro(): Promise<boolean> {
  if (!configured) {
    throw new Error('Purchases not configured');
  }
  const info = await Purchases.restorePurchases();
  return customerHasPro(info);
}

export function isUserCancelledPurchase(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'userCancelled' in error &&
      (error as { userCancelled: boolean | null }).userCancelled,
  );
}

export { Purchases };
