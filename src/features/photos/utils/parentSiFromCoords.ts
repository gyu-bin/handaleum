import municipalitiesGeo from '@/assets/geo/municipalities.json';

import { isEupMyonName } from './adminNames';
import { pointInGeometry, type PackedGeometry } from './geo';

type MuniFeature = PackedGeometry & { name: string };

let siList: MuniFeature[] | null = null;

function siMunicipalities(): MuniFeature[] {
  if (!siList) {
    siList = (
      municipalitiesGeo.municipalities as unknown as MuniFeature[]
    ).filter((m) => /시$/.test(m.name) && !/광역시$|특별시$/.test(m.name));
  }
  return siList;
}

/**
 * When reverse-geocode leaves an 읍·면 as "city" (no parent 시 in address
 * fields), recover the containing 시 from municipality polygons.
 * Gun (군) geometries are not in this file — those still need address lift.
 */
export function parentSiContaining(lat: number, lng: number): string | null {
  for (const muni of siMunicipalities()) {
    if (pointInGeometry(lng, lat, muni)) {
      return muni.name;
    }
  }
  return null;
}

/**
 * If `city` is still an 읍·면 after address parse, replace with parent 시
 * from coords. Returns null when no lift applies.
 */
export function liftEupMyonCity(
  city: string | null,
  lat: number,
  lng: number,
): string | null {
  if (!city || !isEupMyonName(city)) {
    return null;
  }
  return parentSiContaining(lat, lng);
}
