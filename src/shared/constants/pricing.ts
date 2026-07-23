/**
 * Monetization + RevenueCat product mapping.
 * Flip IS_MONETIZATION_LIVE when paywall should gate features.
 * Currently off — Pro purchase / month gate / insight locks disabled.
 */
export const IS_MONETIZATION_LIVE = false;

/** RevenueCat entitlement identifier (dashboard — exact match required). */
export const PRO_ENTITLEMENT_ID = 'Handaleum Pro';

/** App Store / RevenueCat product id. */
export const PRO_PRODUCT_ID = 'handaleum_pro';

/** Pro unlock pricing (KRW). One-time IAP — not a subscription. */
export const PRO_PRICE_KRW = 3990;

export function formatProPriceKrw(price = PRO_PRICE_KRW): string {
  return `₩${price.toLocaleString('ko-KR')}`;
}
