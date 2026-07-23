/**
 * Pro unlock pricing (KRW). One-time IAP — not a subscription.
 * Wire to RevenueCat / StoreKit product when payments ship.
 */
export const PRO_PRICE_KRW = 3990;

export function formatProPriceKrw(price = PRO_PRICE_KRW): string {
  return `₩${price.toLocaleString('ko-KR')}`;
}
