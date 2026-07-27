import Svg, { G, Path, Rect } from 'react-native-svg';
import { memo } from 'react';

import { getMapPalette, type MapPalette } from '@/shared/constants/mapThemes';

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

function Mountains({
  x,
  y,
  s,
  color,
}: {
  x: number;
  y: number;
  s: number;
  color: string;
}) {
  return (
    <Path
      d={`M ${x} ${y} l ${s * 0.45} ${-s} l ${s * 0.45} ${s} M ${x + s * 0.35} ${y} l ${s * 0.4} ${-s * 0.7} l ${s * 0.4} ${s * 0.7}`}
      fill="none"
      stroke={color}
      strokeWidth={1.15}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.42}
    />
  );
}

function Pines({
  x,
  y,
  s,
  color,
}: {
  x: number;
  y: number;
  s: number;
  color: string;
}) {
  const tree = (tx: number) =>
    `M ${tx} ${y} v ${s * 0.15} M ${tx} ${y} l ${-s * 0.22} ${s * 0.35} M ${tx} ${y} l ${s * 0.22} ${s * 0.35} M ${tx} ${y + s * 0.18} l ${-s * 0.28} ${s * 0.4} M ${tx} ${y + s * 0.18} l ${s * 0.28} ${s * 0.4}`;
  return (
    <Path
      d={`${tree(x)} ${tree(x + s * 0.55)} ${tree(x + s * 1.1)}`}
      fill="none"
      stroke={color}
      strokeWidth={1.05}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.4}
    />
  );
}

function Waves({
  x,
  y,
  s,
  color,
}: {
  x: number;
  y: number;
  s: number;
  color: string;
}) {
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

function Compass({
  x,
  y,
  s,
  color,
}: {
  x: number;
  y: number;
  s: number;
  color: string;
}) {
  return (
    <G opacity={0.28}>
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

/** Fractional seats for mountains / pines inside landRect (Figma density). */
const MOUNTAIN_SPOTS: { fx: number; fy: number; scale: number }[] = [
  { fx: 0.42, fy: 0.26, scale: 0.055 },
  { fx: 0.58, fy: 0.48, scale: 0.05 },
  { fx: 0.36, fy: 0.55, scale: 0.042 },
  { fx: 0.72, fy: 0.38, scale: 0.045 },
  { fx: 0.22, fy: 0.44, scale: 0.04 },
  { fx: 0.5, fy: 0.7, scale: 0.048 },
];

const PINE_SPOTS: { fx: number; fy: number; scale: number }[] = [
  { fx: 0.28, fy: 0.36, scale: 0.035 },
  { fx: 0.62, fy: 0.32, scale: 0.032 },
  { fx: 0.34, fy: 0.62, scale: 0.03 },
  { fx: 0.48, fy: 0.42, scale: 0.028 },
  { fx: 0.68, fy: 0.58, scale: 0.03 },
  { fx: 0.18, fy: 0.58, scale: 0.028 },
  { fx: 0.78, fy: 0.46, scale: 0.03 },
  { fx: 0.54, fy: 0.22, scale: 0.026 },
];

function SketchMarks({
  rect,
  palette,
  detail,
}: {
  rect: LandRect;
  palette: MapPalette;
  detail: MapDetail;
}) {
  const { x, y, width: w, height: h } = rect;
  const u = Math.min(w, h);
  const showSeaChrome = detail === 'overview';
  // At region/local show a denser subset so empty land isn't flat parchment.
  const mountains =
    detail === 'overview' ? MOUNTAIN_SPOTS : MOUNTAIN_SPOTS.slice(0, 5);
  const pines = detail === 'overview' ? PINE_SPOTS : PINE_SPOTS.slice(0, 6);

  return (
    <G pointerEvents="none">
      {mountains.map((spot, i) => (
        <Mountains
          key={`mt-${i}`}
          x={x + w * spot.fx}
          y={y + h * spot.fy}
          s={u * spot.scale}
          color={palette.mountain}
        />
      ))}
      {pines.map((spot, i) => (
        <Pines
          key={`pn-${i}`}
          x={x + w * spot.fx}
          y={y + h * spot.fy}
          s={u * spot.scale}
          color={palette.pine}
        />
      ))}
      {showSeaChrome ? (
        <>
          <Waves
            x={x + w * 0.08}
            y={y + h * 0.42}
            s={u * 0.06}
            color={palette.provinceStroke}
          />
          <Waves
            x={x + w * 0.78}
            y={y + h * 0.3}
            s={u * 0.055}
            color={palette.provinceStroke}
          />
          <Waves
            x={x + w * 0.72}
            y={y + h * 0.58}
            s={u * 0.05}
            color={palette.provinceStroke}
          />
          <Compass
            x={x + w * 0.86}
            y={y + h * 0.82}
            s={u * 0.055}
            color={palette.provinceStroke}
          />
        </>
      ) : null}
    </G>
  );
}

/** Multi-pass ink coast — darker final pass reads like the Figma silhouette. */
const COAST_PASSES: { dx: number; dy: number; opacity: number; width: number }[] =
  [
    { dx: 1.8, dy: 1.5, opacity: 0.1, width: 3.0 },
    { dx: -1.0, dy: 0.8, opacity: 0.14, width: 2.1 },
    { dx: 0.5, dy: -0.4, opacity: 0.22, width: 1.55 },
    { dx: 0, dy: 0, opacity: 0.62, width: 1.35 },
  ];

/**
 * Paper Korea map geometry only. Place names render outside the zoom transform
 * (MapFloatingLabel + MapCameraLayer) so type stays constant on screen.
 *
 * Visual tone follows the Figma survey mock: parchment land, soft sky water,
 * multi-pass ink coast, sketch mountains/pines — still pure SVG so rebase/zoom
 * stay crisp. Photo pins stay on ClusterPin.
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
  const ink = palette.provinceStroke;
  const showMarks = Boolean(landRect && landRect.width > 40);

  const provinceStroke =
    detail === 'overview'
      ? { opacity: 0.28, width: 0.7 }
      : detail === 'region'
        ? { opacity: 0.62, width: 1.35 }
        : { opacity: 0.7, width: 1.55 };
  const cityStroke =
    detail === 'overview'
      ? { opacity: 0.16, width: 0.5 }
      : detail === 'region'
        ? { opacity: 0.48, width: 0.95 }
        : { opacity: 0.58, width: 1.15 };
  const districtStroke =
    detail === 'region'
      ? { opacity: 0.4, width: 0.75 }
      : { opacity: 0.52, width: 0.95 };

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
            transform="translate(1.5, 2.2)"
          />
          <Path d={koreaPath} fill={palette.landDeep} />
          <Path d={koreaPath} fill={palette.land} />
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
          stroke={palette.cityStroke}
          strokeOpacity={cityStroke.opacity}
          strokeWidth={cityStroke.width}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {districtPaths.map((district) => (
        <Path
          key={district.id}
          d={district.d}
          fill="none"
          stroke={palette.cityStroke}
          strokeOpacity={districtStroke.opacity}
          strokeWidth={districtStroke.width}
          strokeLinejoin="round"
          strokeLinecap="round"
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
          strokeLinecap="round"
        />
      ))}

      {showMarks && landRect ? (
        <SketchMarks rect={landRect} palette={palette} detail={detail} />
      ) : null}
    </Svg>
  );
});
