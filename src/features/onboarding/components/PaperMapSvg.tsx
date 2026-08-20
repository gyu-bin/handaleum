import Svg, { G, Path, Rect } from 'react-native-svg';

import { getMapPalette } from '@/shared/constants/mapThemes';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';

/**
 * Coast passes measured in device px. `scale` divides them before they reach
 * the SVG, so the ink line stays a hairline at any size — a viewBox-unit width
 * thickens into a cartoon outline as the map grows.
 */
const COAST_PASSES = [
  { dx: 0.9, dy: 0.75, opacity: 0.1, width: 1.6 },
  { dx: -0.5, dy: 0.4, opacity: 0.14, width: 1.15 },
  { dx: 0.25, dy: -0.2, opacity: 0.22, width: 0.85 },
  { dx: 0, dy: 0, opacity: 0.55, width: 0.7 },
] as const;

/** Relief offset, also in device px. */
const LAND_SHADOW = { dx: 1.0, dy: 1.2 };

export interface PaperMapSvgProps {
  width: number;
  height: number;
  /** px per viewBox unit — hairline widths are divided by this. */
  scale: number;
}

/**
 * The peninsula as drawn ink on paper: dawn water, warm land, and a coast
 * built from four offset passes so the edge reads as a pen line, not a border.
 */
export function PaperMapSvg({ width, height, scale }: PaperMapSvgProps) {
  const palette = getMapPalette('dawn');
  const d = KOREA_SILHOUETTE.path;

  return (
    <Svg width={width} height={height} viewBox={KOREA_SILHOUETTE.viewBox}>
      <Rect x={-4} y={-4} width={60} height={108} fill={palette.water} />
      <G>
        <Path
          d={d}
          fill={palette.landShadow}
          transform={`translate(${LAND_SHADOW.dx / scale}, ${LAND_SHADOW.dy / scale})`}
        />
        <Path d={d} fill={palette.landDeep} />
        <Path d={d} fill={palette.land} />
        {COAST_PASSES.map((pass) => (
          <Path
            key={`${pass.dx}-${pass.dy}-${pass.width}`}
            d={d}
            fill="none"
            stroke={palette.provinceStroke}
            strokeOpacity={pass.opacity}
            strokeWidth={pass.width / scale}
            strokeLinejoin="round"
            strokeLinecap="round"
            transform={
              pass.dx === 0 && pass.dy === 0
                ? undefined
                : `translate(${pass.dx / scale}, ${pass.dy / scale})`
            }
          />
        ))}
      </G>
    </Svg>
  );
}
