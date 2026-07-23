/**
 * When false, all pro gates are off — every month and insight is available.
 * Flip to true when StoreKit / RevenueCat ships.
 */
export const IS_MONETIZATION_LIVE = false;

/**
 * Pro unlock pricing (KRW). One-time IAP — not a subscription.
 * Used when IS_MONETIZATION_LIVE is true.
 */
export const PRO_PRICE_KRW = 3990;

export function formatProPriceKrw(price = PRO_PRICE_KRW): string {
  return `₩${price.toLocaleString('ko-KR')}`;
}
