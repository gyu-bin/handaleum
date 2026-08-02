/**
 * Approximate South Korea bbox for 발도장 (mainland + Jeju + nearby islands).
 * Foreign GPS is skipped before reverse-geocode — stamps are domestic-only.
 *
 * Rough coverage: 제주~접경, 서해~독도. Not a legal boundary.
 */
const MIN_LAT = 33.0;
const MAX_LAT = 38.72;
const MIN_LNG = 124.4;
const MAX_LNG = 132.1;

export function isKoreaLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= MIN_LAT &&
    lat <= MAX_LAT &&
    lng >= MIN_LNG &&
    lng <= MAX_LNG
  );
}
