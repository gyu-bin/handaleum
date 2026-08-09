/**
 * Incheon / island provinces must label on the mainland mass.
 * Run: npx tsx src/features/photos/utils/geo.labelAnchor.check.ts
 */
import assert from 'node:assert/strict';

import provincesGeo from '../../../../assets/geo/provinces.json';

import {
  centroidOf,
  labelAnchorOf,
  mainlandPolygons,
  type PackedGeometry,
} from './geo';

const list = provincesGeo.provinces as unknown as (PackedGeometry & {
  name: string;
})[];

const incheon = list.find((p) => p.name === '인천');
assert.ok(incheon, '인천 feature');

const geom: PackedGeometry = {
  type: incheon.type,
  coordinates: incheon.coordinates,
};
const naive = centroidOf(geom);
const minLng = 125.85;
const anchor = labelAnchorOf(geom, minLng);
assert.ok(
  anchor[0] > 126.3,
  `인천 label lng should be mainland (~126.5+), got ${anchor[0]} (naive ${naive[0]})`,
);
assert.ok(anchor[0] > naive[0], 'mainland anchor should sit east of full bbox center');

const land = mainlandPolygons(geom, minLng);
assert.ok(land.coordinates.length >= 1);
assert.ok(land.coordinates.length < geom.coordinates.length);

console.log('geo.labelAnchor.check.ts: ok', {
  naive,
  anchor,
  polys: `${land.coordinates.length}/${geom.coordinates.length}`,
});
