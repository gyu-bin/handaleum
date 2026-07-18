import Svg, { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import {
  getMapPalette,
  type MapPalette,
} from '@/shared/constants/mapThemes';
import type { MapThemeId } from '../types';

export interface ProjectedLabel {
  key: string;
  text: string;
  x: number;
  y: number;
  /** 0 = province (도), 1–3 = city. */
  tier: 0 | 1 | 2 | 3;
}

export interface MapSvgProps {
  width: number;
  height: number;
  koreaPath: string;
  provincePaths: { id: string; d: string }[];
  cityPaths: { id: string; d: string }[];
  /** Soft 도 / 시 names — painted with the map so they never desync. */
  labels: ProjectedLabel[];
  themeId?: MapThemeId;
}

function labelStyle(
  palette: MapPalette,
): Record<
  0 | 1 | 2 | 3,
  { size: number; opacity: number; weight: '400' | '500' | '600'; color: string }
> {
  return {
    0: { size: 4.8, opacity: 0.48, weight: '500', color: palette.labelProvince },
    1: { size: 4.4, opacity: 0.62, weight: '600', color: palette.labelCity },
    2: { size: 3.6, opacity: 0.48, weight: '500', color: palette.labelProvince },
    3: { size: 3.2, opacity: 0.4, weight: '400', color: palette.labelMinor },
  };
}

/**
 * Paper map. Labels live in the SVG so they stick to geography.
 * Strokes scale with zoom so boundaries stay smooth when pinched in.
 */
export function MapSvg({
  width,
  height,
  koreaPath,
  provincePaths,
  cityPaths,
  labels,
  themeId = 'dawn',
}: MapSvgProps) {
  const palette = getMapPalette(themeId);
  const styles = labelStyle(palette);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect
        x={-width * 2}
        y={-height * 2}
        width={width * 5}
        height={height * 5}
        fill={palette.water}
      />

      {koreaPath ? (
        <G>
          <Path
            d={koreaPath}
            fill={palette.landShadow}
            transform="translate(1, 2)"
          />
          <Path
            d={koreaPath}
            fill={palette.land}
            stroke={palette.border}
            strokeWidth={0.9}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </G>
      ) : null}

      {cityPaths.map((city) => (
        <Path
          key={city.id}
          d={city.d}
          fill="none"
          stroke={palette.cityStroke}
          strokeOpacity={0.5}
          strokeWidth={0.35}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {provincePaths.map((province) => (
        <Path
          key={province.id}
          d={province.d}
          fill="none"
          stroke={palette.provinceStroke}
          strokeOpacity={0.28}
          strokeWidth={0.55}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {labels.map((label) => {
        const s = styles[label.tier];
        return (
          <SvgText
            key={label.key}
            x={label.x}
            y={label.y}
            fontSize={s.size}
            fontWeight={s.weight}
            fill={s.color}
            opacity={s.opacity}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {label.text}
          </SvgText>
        );
      })}
    </Svg>
  );
}
