import Svg, { G, Path, Rect } from 'react-native-svg';
import { memo } from 'react';

import { getMapPalette } from '@/shared/constants/mapThemes';
import { theme } from '@/shared/constants/theme';

import type { MapThemeId } from '../types';

export type MapDetail = 'overview' | 'region' | 'local';

export interface ProjectedLabel {
  key: string;
  text: string;
  x: number;
  y: number;
  /** 0 = province (도), 1–3 = city / municipality grain. */
  tier: 0 | 1 | 2 | 3;
}

/** Screen rect of the projected Korea focus — used to seat sketch marks. */
export interface LandRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlaceStamp {
  key: string;
  text: string;
  x: number;
  y: number;
}

export interface MapSvgProps {
  width: number;
  height: number;
  koreaPath: string;
  provincePaths: { id: string; d: string }[];
  cityPaths: { id: string; d: string }[];
  /** Metro 자치구 boundaries — region/local only. */
  districtPaths?: { id: string; d: string }[];
  themeId?: MapThemeId;
  detail?: MapDetail;
  landRect?: LandRect | null;
}

function Mountains({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <Path
      d={`M ${x} ${y} l ${s * 0.45} ${-s} l ${s * 0.45} ${s} M ${x + s * 0.35} ${y} l ${s * 0.4} ${-s * 0.7} l ${s * 0.4} ${s * 0.7}`}
      fill="none"
      stroke={color}
      strokeWidth={1.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.4}
    />
  );
}

function Pines({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  const tree = (tx: number) =>
    `M ${tx} ${y} v ${s * 0.15} M ${tx} ${y} l ${-s * 0.22} ${s * 0.35} M ${tx} ${y} l ${s * 0.22} ${s * 0.35} M ${tx} ${y + s * 0.18} l ${-s * 0.28} ${s * 0.4} M ${tx} ${y + s * 0.18} l ${s * 0.28} ${s * 0.4}`;
  return (
    <Path
      d={`${tree(x)} ${tree(x + s * 0.55)} ${tree(x + s * 1.1)}`}
      fill="none"
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.38}
    />
  );
}

function Waves({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <Path
      d={`M ${x} ${y} q ${s * 0.25} ${-s * 0.2} ${s * 0.5} 0 q ${s * 0.25} ${s * 0.2} ${s * 0.5} 0 M ${x} ${y + s * 0.35} q ${s * 0.25} ${-s * 0.18} ${s * 0.5} 0 q ${s * 0.25} ${s * 0.18} ${s * 0.5} 0`}
      fill="none"
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
      opacity={0.28}
    />
  );
}

function Compass({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <G opacity={0.32}>
      <Path
        d={`M ${x} ${y - s} L ${x + s * 0.18} ${y} L ${x} ${y + s} L ${x - s * 0.18} ${y} Z M ${x - s} ${y} L ${x} ${y - s * 0.18} L ${x + s} ${y} L ${x} ${y + s * 0.18} Z`}
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Path
        d={`M ${x} ${y - s * 0.55} L ${x} ${y + s * 0.55} M ${x - s * 0.55} ${y} L ${x + s * 0.55} ${y}`}
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
    </G>
  );
}

function SketchMarks({ rect, color }: { rect: LandRect; color: string }) {
  const { x, y, width: w, height: h } = rect;
  const u = Math.min(w, h);
  return (
    <G pointerEvents="none">
      <Mountains x={x + w * 0.42} y={y + h * 0.28} s={u * 0.055} color={color} />
      <Mountains x={x + w * 0.58} y={y + h * 0.52} s={u * 0.048} color={color} />
      <Pines x={x + w * 0.28} y={y + h * 0.38} s={u * 0.035} color={color} />
      <Pines x={x + w * 0.62} y={y + h * 0.34} s={u * 0.032} color={color} />
      <Pines x={x + w * 0.34} y={y + h * 0.62} s={u * 0.03} color={color} />
      <Waves x={x + w * 0.08} y={y + h * 0.42} s={u * 0.06} color={color} />
      <Waves x={x + w * 0.78} y={y + h * 0.3} s={u * 0.055} color={color} />
      <Waves x={x + w * 0.72} y={y + h * 0.58} s={u * 0.05} color={color} />
      <Compass x={x + w * 0.86} y={y + h * 0.82} s={u * 0.055} color={color} />
    </G>
  );
}

const COAST_PASSES: { dx: number; dy: number; opacity: number; width: number }[] = [
  { dx: 1.4, dy: 1.1, opacity: 0.12, width: 2.2 },
  { dx: -0.8, dy: 0.6, opacity: 0.16, width: 1.6 },
  { dx: 0, dy: 0, opacity: 0.55, width: 1.35 },
];

/**
 * Paper Korea map geometry only. Place names render outside the zoom transform
 * (MapFloatingLabel + MapCameraLayer) so type stays constant on screen.
 */
export const MapSvg = memo(function MapSvg({
  width,
  height,
  koreaPath,
  provincePaths,
  cityPaths,
  districtPaths = [],
  themeId = 'dawn',
  detail = 'overview',
  landRect = null,
}: MapSvgProps) {
  const palette = getMapPalette(themeId);
  const ink = theme.colors.accent;
  const showMarks = detail === 'overview' && Boolean(landRect && landRect.width > 40);

  const provinceStroke =
    detail === 'overview'
      ? { opacity: 0.14, width: 0.45 }
      : detail === 'region'
        ? { opacity: 0.42, width: 1.1 }
        : { opacity: 0.5, width: 1.35 };
  const cityStroke =
    detail === 'overview'
      ? { opacity: 0.07, width: 0.35 }
      : detail === 'region'
        ? { opacity: 0.28, width: 0.75 }
        : { opacity: 0.38, width: 0.95 };
  const districtStroke =
    detail === 'region'
      ? { opacity: 0.22, width: 0.55 }
      : { opacity: 0.32, width: 0.7 };

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
          <Path d={koreaPath} fill={theme.colors.landLight} />
          {COAST_PASSES.map((pass) => (
            <Path
              key={`${pass.dx}-${pass.dy}-${pass.width}`}
              d={koreaPath}
              fill="none"
              stroke={ink}
              strokeOpacity={pass.opacity}
              strokeWidth={pass.width}
              strokeLinejoin="round"
              strokeLinecap="round"
              transform={
                pass.dx === 0 && pass.dy === 0
                  ? undefined
                  : `translate(${pass.dx}, ${pass.dy})`
              }
            />
          ))}
        </G>
      ) : null}

      {cityPaths.map((city) => (
        <Path
          key={city.id}
          d={city.d}
          fill="none"
          stroke={ink}
          strokeOpacity={cityStroke.opacity}
          strokeWidth={cityStroke.width}
          strokeLinejoin="round"
        />
      ))}
      {districtPaths.map((district) => (
        <Path
          key={district.id}
          d={district.d}
          fill="none"
          stroke={ink}
          strokeOpacity={districtStroke.opacity}
          strokeWidth={districtStroke.width}
          strokeLinejoin="round"
        />
      ))}
      {provincePaths.map((province) => (
        <Path
          key={province.id}
          d={province.d}
          fill="none"
          stroke={ink}
          strokeOpacity={provinceStroke.opacity}
          strokeWidth={provinceStroke.width}
          strokeLinejoin="round"
        />
      ))}

      {showMarks && landRect ? <SketchMarks rect={landRect} color={ink} /> : null}
    </Svg>
  );
});
