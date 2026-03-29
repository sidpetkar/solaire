export interface ParsedLUT {
  size: number;
  data: Float32Array;
}

export type LutTier = 'free' | 'pro';

export interface LUTMeta {
  id: string;
  name: string;
  shortCode: string;
  category: LUTCategory;
  path: string;
  binPath?: string | null;
  thumbIndex?: number;
  tier: LutTier;
}

export type LUTCategory = string;

export interface SavedImage {
  id: string;
  blob: Blob;
  thumbnailBlob: Blob;
  timestamp: number;
  lutId?: string;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '5:2' | '4:5' | '3:2';

export const ASPECT_RATIOS: { label: AspectRatio; value: number }[] = [
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '5:2', value: 5 / 2 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:2', value: 3 / 2 },
];
