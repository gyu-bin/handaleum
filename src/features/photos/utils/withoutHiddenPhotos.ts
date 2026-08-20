export function withoutHiddenPhotos<T extends { assetId: string }>(
  photos: T[],
  hidden: ReadonlySet<string>,
): T[] {
  if (hidden.size === 0) {
    return photos;
  }
  return photos.filter((photo) => !hidden.has(photo.assetId));
}
