/** Short chip on a collage cell — 구, else 시·군, else 시·도. */
export function cardPhotoPlaceChip(place: {
  gu: string | null;
  city: string | null;
  province: string | null;
}): string | null {
  const gu = place.gu?.trim();
  if (gu) {
    return gu;
  }
  const city = place.city?.trim();
  if (city) {
    return city;
  }
  const province = place.province?.trim();
  return province || null;
}
