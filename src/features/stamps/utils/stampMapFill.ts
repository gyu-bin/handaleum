/**
 * Soft washes for the visit atlas — airy pastels on cream paper.
 * Stable per key so the same 시·도 / L1 keeps the same color.
 */
const PALETTE = [
  'rgba(120, 168, 188, 0.42)',
  'rgba(148, 176, 138, 0.40)',
  'rgba(188, 148, 132, 0.38)',
  'rgba(132, 160, 178, 0.42)',
  'rgba(172, 164, 128, 0.38)',
  'rgba(128, 176, 168, 0.40)',
  'rgba(180, 142, 150, 0.36)',
  'rgba(142, 154, 182, 0.40)',
  'rgba(160, 178, 140, 0.38)',
  'rgba(190, 158, 128, 0.36)',
] as const;

export function stampMapFill(key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}
