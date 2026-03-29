import type { LutTier } from '../types';

/**
 * Free-tier film stocks (12). Match manifest `brand` + `displayName` exactly.
 */
const FREE_LUTS: readonly { brand: string; name: string }[] = [
  { brand: 'Kodak', name: 'Portra 400' },
  { brand: 'Kodak', name: 'Portra 160' },
  { brand: 'Fuji', name: 'Superia 400' },
  { brand: 'Kodak', name: 'Tri-X 400' },
  { brand: 'Illford', name: 'HP 5 Plus 400' },
  { brand: 'Fuji', name: 'Velvia 50' },
  { brand: 'Kodak', name: 'Kodachrome 64' },
  { brand: 'Fuji', name: 'Provia 100F' },
  { brand: 'Kodak', name: '2383 Constlclip' },
  { brand: 'Fuji', name: '3513 Constlclip' },
  { brand: 'Kodak', name: 'Ektar 100' },
  { brand: 'Illford', name: 'Delta 400' },
];

export function lutTierFor(brand: string, displayName: string): LutTier {
  return FREE_LUTS.some((f) => f.brand === brand && f.name === displayName)
    ? 'free'
    : 'pro';
}

/** Free users cannot save/download/move when a premium LUT is applied (preview on canvas is OK). */
export function premiumExportBlocked(
  meta: { tier?: LutTier } | null | undefined,
  isProUser: boolean,
): boolean {
  if (isProUser) return false;
  if (!meta) return false;
  return meta.tier === 'pro';
}

/** Max library images for non‑Pro users */
export const FREE_IMAGE_LIMIT = 3;

export function canImportMoreImages(isProUser: boolean, currentCount: number): boolean {
  return isProUser || currentCount < FREE_IMAGE_LIMIT;
}
