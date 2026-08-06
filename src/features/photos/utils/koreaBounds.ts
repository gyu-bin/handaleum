/**
 * Approximate South Korea bbox (mainland + Jeju + nearby islands).
 * Map pins and 발도장 skip foreign GPS — not a legal boundary.
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
