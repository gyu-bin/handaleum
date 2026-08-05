export type AssetLocationRow = {
  id: string;
  /** Present only when the asset has GPS metadata. */
  latitude?: number;
  longitude?: number;
};
