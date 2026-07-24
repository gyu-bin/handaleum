import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import koreaGeo from '@/assets/geo/korea.json';
import municipalitiesGeo from '@/assets/geo/municipalities.json';
import provincesGeo from '@/assets/geo/provinces.json';
import { isCityNearPins, KOREA_CITIES } from '@/shared/constants/koreaCities';
import { theme } from '@/shared/constants/theme';

import {
  bboxOf,
  createProjection,
  geometryToPath,
  type PackedGeometry,
} from '../utils/geo';

const MAP_PAD = 6;
const FOCUS_BBOX = {
  minLng: 125.75,
  maxLng: 129.6,
  minLat: 33.08,
  maxLat: 38.62,
};

/** Minimum span (degrees) so a single pin still has a readable neighborhood. */
const MIN_PIN_SPAN_LNG = 0.1;
const MIN_PIN_SPAN_LAT = 0.085;
/** Extra margin around the pin cluster — keep tight so the card map feels zoomed in. */
const PIN_PAD_RATIO = 0.22;

export interface PaperMapPin {
  id: string;
  lat: number;
  lng: number;
  highlight?: boolean;
}

export interface PaperMapProps {
  pins: PaperMapPin[];
  width: number;
  height: number;
}

type ProvinceFeature = PackedGeometry & { id: string };
type MuniFeature = PackedGeometry & { id: string };

/**
 * Static paper Korea map for card templates (no zoom, no footpath).
 */
export function PaperMap({ pins, width, height }: PaperMapProps) {
  const southKorea = koreaGeo.korea as unknown as PackedGeometry;
  const provinces = provincesGeo.provinces as unknown as ProvinceFeature[];
  const municipalities =
    municipalitiesGeo.municipalities as unknown as MuniFeature[];

  const projection = useMemo(() => {
    if (width <= 0 || height <= 0) {
      return null;
    }
    const raw = bboxOf(southKorea);
    const focused = {
      minLng: Math.max(raw.minLng, FOCUS_BBOX.minLng),
      maxLng: Math.min(raw.maxLng, FOCUS_BBOX.maxLng),
      minLat: Math.max(raw.minLat, FOCUS_BBOX.minLat),
      maxLat: Math.min(raw.maxLat, FOCUS_BBOX.maxLat),
    };

    if (pins.length > 0) {
      let minLng = Infinity;
      let maxLng = -Infinity;
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const pin of pins) {
        minLng = Math.min(minLng, pin.lng);
        maxLng = Math.max(maxLng, pin.lng);
        minLat = Math.min(minLat, pin.lat);
        maxLat = Math.max(maxLat, pin.lat);
      }
      const spanLng = Math.max(maxLng - minLng, MIN_PIN_SPAN_LNG);
      const spanLat = Math.max(maxLat - minLat, MIN_PIN_SPAN_LAT);
      // Center the (possibly expanded) span on the pin cluster, then pad lightly.
      const midLng = (minLng + maxLng) / 2;
      const midLat = (minLat + maxLat) / 2;
      const halfLng = (spanLng / 2) * (1 + PIN_PAD_RATIO);
      const halfLat = (spanLat / 2) * (1 + PIN_PAD_RATIO);
      return createProjection(
        {
          minLng: Math.max(focused.minLng, midLng - halfLng),
          maxLng: Math.min(focused.maxLng, midLng + halfLng),
          minLat: Math.max(focused.minLat, midLat - halfLat),
          maxLat: Math.min(focused.maxLat, midLat + halfLat),
        },
        width,
        height,
        MAP_PAD,
      );
    }

    return createProjection(focused, width, height, MAP_PAD);
  }, [southKorea, width, height, pins]);

  const koreaPath = useMemo(
    () => (projection ? geometryToPath(southKorea, projection.project) : ''),
    [southKorea, projection],
  );

  const provincePaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    return provinces.map((province) => ({
      id: province.id,
      d: geometryToPath(province, projection.project),
    }));
  }, [provinces, projection]);

  const cityPaths = useMemo(() => {
    if (!projection) {
      return [];
    }
    return municipalities.map((muni) => ({
      id: muni.id,
      d: geometryToPath(muni, projection.project),
    }));
  }, [municipalities, projection]);

  const cityLabels = useMemo(() => {
    if (!projection) {
      return [];
    }
    const near = pins.map((p) => ({ lng: p.lng, lat: p.lat }));
    return KOREA_CITIES.filter((city) => isCityNearPins(city, near)).map((city) => {
      const [x, y] = projection.project(city.c);
      return { name: city.name, x: x + 4, y, tier: city.tier };
    });
  }, [pins, projection]);

  const pinPoints = useMemo(() => {
    if (!projection) {
      return [];
    }
    return pins.map((pin) => {
      const [x, y] = projection.project([pin.lng, pin.lat]);
      return { ...pin, x, y };
    });
  }, [pins, projection]);

  if (width <= 0 || height <= 0) {
    return <View style={{ width, height, backgroundColor: theme.colors.water }} />;
  }

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x={0} y={0} width={width} height={height} fill={theme.colors.water} />

        {koreaPath ? (
          <G>
            <Path
              d={koreaPath}
              fill={theme.colors.landShadow}
              transform="translate(1, 2)"
            />
            <Path
              d={koreaPath}
              fill={theme.colors.land}
              stroke={theme.colors.border}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </G>
        ) : null}

        {cityPaths.map((city) => (
          <Path
            key={city.id}
            d={city.d}
            fill="none"
            stroke={theme.colors.border}
            strokeOpacity={0.5}
            strokeWidth={0.4}
            strokeLinejoin="round"
          />
        ))}

        {provincePaths.map((province) => (
          <Path
            key={province.id}
            d={province.d}
            fill="none"
            stroke={theme.colors.border}
            strokeOpacity={0.65}
            strokeWidth={0.65}
            strokeLinejoin="round"
          />
        ))}

        {cityLabels.map((label) => (
          <SvgText
            key={label.name}
            x={label.x}
            y={label.y}
            fontSize={label.tier === 1 ? 10 : label.tier === 2 ? 8 : 7}
            fontWeight={label.tier === 1 ? '600' : '500'}
            fill={theme.colors.inkSoft}
            opacity={label.tier === 1 ? 0.85 : label.tier === 2 ? 0.65 : 0.5}
          >
            {label.name}
          </SvgText>
        ))}

        {pinPoints.map((pin) => (
          <G key={pin.id}>
            <Circle
              cx={pin.x}
              cy={pin.y}
              r={pin.highlight ? 7 : 5.5}
              fill={theme.colors.surface}
              stroke={pin.highlight ? theme.colors.accent : theme.colors.ink}
              strokeWidth={1.4}
            />
            <Circle cx={pin.x} cy={pin.y} r={3.2} fill={theme.colors.landDeep} />
          </G>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: theme.colors.water,
  },
});
