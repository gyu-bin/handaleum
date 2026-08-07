/**
 * Card paper skins — background only (life-4-cut style).
 * Photos / layout stay the same; ink colors flip on dark paper.
 */

export const PAPER_SKIN_IDS = [
  'ivory',
  'fog',
  'sage',
  'blush',
  'ink',
] as const;

export type PaperSkinId = (typeof PAPER_SKIN_IDS)[number];

export type PaperSkinTone = {
  id: PaperSkinId;
  /** Swatch + paper fill. */
  paper: string;
  /** Primary type / ticks on this paper. */
  ink: string;
  inkSoft: string;
  subtle: string;
  /** Frame + hairline rule. */
  line: string;
};

export const PAPER_SKINS: Record<PaperSkinId, PaperSkinTone> = {
  ivory: {
    id: 'ivory',
    paper: '#F7F1E8',
    ink: '#2C3E50',
    inkSoft: '#5A6B7A',
    subtle: '#93A1AD',
    line: 'rgba(44,62,80,0.18)',
  },
  fog: {
    id: 'fog',
    paper: '#E6EDF2',
    ink: '#2C3E50',
    inkSoft: '#5A6B7A',
    subtle: '#7A8B99',
    line: 'rgba(44,62,80,0.18)',
  },
  sage: {
    id: 'sage',
    paper: '#E8EEE6',
    ink: '#2C3E50',
    inkSoft: '#5A6B7A',
    subtle: '#7A8B7E',
    line: 'rgba(44,62,80,0.18)',
  },
  blush: {
    id: 'blush',
    paper: '#F3E8E6',
    ink: '#2C3E50',
    inkSoft: '#5A6B7A',
    subtle: '#9A8582',
    line: 'rgba(44,62,80,0.18)',
  },
  ink: {
    id: 'ink',
    paper: '#2C3E50',
    ink: '#F7F1E8',
    inkSoft: 'rgba(247,241,232,0.78)',
    subtle: 'rgba(247,241,232,0.5)',
    line: 'rgba(247,241,232,0.28)',
  },
};

export const DEFAULT_PAPER_SKIN: PaperSkinId = 'ivory';

export function resolvePaperSkin(
  id: string | null | undefined,
): PaperSkinTone {
  if (id && id in PAPER_SKINS) {
    return PAPER_SKINS[id as PaperSkinId];
  }
  return PAPER_SKINS[DEFAULT_PAPER_SKIN];
}
