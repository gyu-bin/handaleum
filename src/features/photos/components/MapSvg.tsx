import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import {
  getMapPalette,
  type MapPalette,
} from '@/shared/constants/mapThemes';
import type { GraticuleLine } from '../hooks/useMapProjection';
import type { MapThemeId } from '../types';

/**
 * Coastline echoes — the shore repeated outward at falling strength, the way a
 * survey plate accumulates contour. Offsets are in viewBox units.
 */
const COAST_ECHOES: { dx: number; opacity: number }[] = [
  { dx: 6, opacity: 0.05 },
  { dx: 2.8, opacity: 0.08 },
];

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
  /** Whole-degree rule under the land. Omit to draw no graticule. */
  graticule?: GraticuleLine[];
  /**
   * Raster oversampling factor. The SVG is laid out this many times larger in
   * native points while keeping the same viewBox coordinate system, so the
   * parent can scale it up by the same amount without softening the strokes.
   * Geometry and coordinates are unaffected — only the backing raster density.
   */
  resolution?: number;
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
 * The parent re-projects (rebases) at zoom settle, so stroke widths and label
 * sizes here are screen-space constants — they look the same at every depth.
 */
export function MapSvg({
  width,
  height,
  koreaPath,
  provincePaths,
  cityPaths,
  labels,
  graticule = [],
  resolution = 1,
  themeId = 'dawn',
}: MapSvgProps) {
  const palette = getMapPalette(themeId);
  const styles = labelStyle(palette);

  return (
    <Svg
      width={width * resolution}
      height={height * resolution}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Rect
        x={-width * 2}
        y={-height * 2}
        width={width * 5}
        height={height * 5}
        fill={palette.water}
      />

      {graticule.map((line) => (
        <Line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke={palette.provinceStroke}
          strokeOpacity={0.09}
          strokeWidth={0.4}
        />
      ))}

      {koreaPath ? (
        <G>
          {COAST_ECHOES.map((echo) => (
            <Path
              key={`echo-${echo.dx}`}
              d={koreaPath}
              fill="none"
              stroke={palette.provinceStroke}
              strokeOpacity={echo.opacity}
              strokeWidth={0.6}
              strokeLinejoin="round"
              transform={`translate(${echo.dx}, ${echo.dx * 0.6})`}
            />
          ))}
          <Path d={koreaPath} fill={palette.land} />
        </G>
      ) : null}

      {cityPaths.map((city) => (
        <Path
          key={city.id}
          d={city.d}
          fill="none"
          stroke={palette.provinceStroke}
          strokeOpacity={0.14}
          strokeWidth={0.32}
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
          strokeOpacity={0.3}
          strokeWidth={0.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Coast last, so no inland boundary ever crosses the shore. */}
      {koreaPath ? (
        <Path
          d={koreaPath}
          fill="none"
          stroke={palette.provinceStroke}
          strokeOpacity={0.66}
          strokeWidth={0.85}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

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
