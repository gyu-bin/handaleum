import type { MapDetail, ProjectedLabel } from '../components/MapSvg';
import { SCREEN_LABEL_SIZE } from './mapLabelStyle';

const CHAR_WIDTH = 0.62;
const PAD = 4;

type Box = { left: number; right: number; top: number; bottom: number };

function labelBox(label: ProjectedLabel): Box {
  const size = SCREEN_LABEL_SIZE[label.tier];
  const halfW = (label.text.length * size * CHAR_WIDTH) / 2 + PAD;
  const halfH = size / 2 + PAD;
  return {
    left: label.x - halfW,
    right: label.x + halfW,
    top: label.y - halfH,
    bottom: label.y + halfH,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

/**
 * Greedy collision in projected map space using fixed screen font sizes.
 * Keep lower tier first; drop later labels that overlap.
 */
export function collideLabels(
  labels: ProjectedLabel[],
  _detail: MapDetail,
): ProjectedLabel[] {
  const muniNames = new Set(
    labels.filter((l) => l.key.startsWith('muni-')).map((l) => l.text),
  );

  const sorted = [...labels].sort((a, b) => {
    if (a.tier !== b.tier) {
      return a.tier - b.tier;
    }
    const aMuni = a.key.startsWith('muni-') ? 0 : 1;
    const bMuni = b.key.startsWith('muni-') ? 0 : 1;
    return aMuni - bMuni;
  });

  const kept: ProjectedLabel[] = [];
  const boxes: Box[] = [];
  const seenText = new Set<string>();

  for (const label of sorted) {
    if (label.key.startsWith('hub-') && muniNames.has(label.text)) {
      continue;
    }
    if (seenText.has(label.text)) {
      continue;
    }
    const box = labelBox(label);
    if (boxes.some((placed) => overlaps(box, placed))) {
      continue;
    }
    kept.push(label);
    boxes.push(box);
    seenText.add(label.text);
  }

  return kept;
}
