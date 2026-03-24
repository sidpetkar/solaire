export interface AdjustParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface AdjustToolDef {
  id: string;
  label: string;
  icon: string;
  type: 'uber' | 'pass' | 'overlay' | 'blur';
  params: AdjustParamDef[];
}

export type AdjustParams = Record<string, number>;

export interface BlurParams {
  amount: number;
  center: [number, number];
  mode: 'circular' | 'linear';
  angle: number;
}

export const ADJUST_TOOLS: AdjustToolDef[] = [
  {
    id: 'crop',
    label: 'Crop',
    icon: 'Crop',
    type: 'overlay',
    params: [],
  },
  {
    id: 'exposure',
    label: 'Exposure',
    icon: 'Sun',
    type: 'uber',
    params: [{ key: 'exposure', label: 'Exposure', min: -100, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'brightness',
    label: 'Brightness',
    icon: 'SunDim',
    type: 'uber',
    params: [{ key: 'brightness', label: 'Brightness', min: -100, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'contrast',
    label: 'Contrast',
    icon: 'CircleHalf',
    type: 'uber',
    params: [{ key: 'contrast', label: 'Contrast', min: -100, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'highlights-shadows',
    label: 'HL & Shadow',
    icon: 'SunHorizon',
    type: 'uber',
    params: [
      { key: 'highlights', label: 'Highlights', min: -100, max: 100, default: 0, step: 1 },
      { key: 'shadows', label: 'Shadows', min: -100, max: 100, default: 0, step: 1 },
    ],
  },
  {
    id: 'saturation',
    label: 'Saturation',
    icon: 'Drop',
    type: 'uber',
    params: [{ key: 'saturation', label: 'Saturation', min: -100, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'white-balance',
    label: 'White Balance',
    icon: 'Thermometer',
    type: 'uber',
    params: [
      { key: 'temperature', label: 'Temperature', min: -100, max: 100, default: 0, step: 1 },
      { key: 'tint', label: 'Tint', min: -100, max: 100, default: 0, step: 1 },
    ],
  },
  {
    id: 'sharpen',
    label: 'Sharpen',
    icon: 'Diamond',
    type: 'pass',
    params: [{ key: 'sharpen', label: 'Sharpen', min: 0, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'grain',
    label: 'Grain',
    icon: 'DotsNine',
    type: 'pass',
    params: [
      { key: 'grain_strength', label: 'Strength', min: 0, max: 100, default: 0, step: 1 },
      { key: 'grain_size', label: 'Size', min: 50, max: 800, default: 300, step: 10 },
    ],
  },
  {
    id: 'vignette',
    label: 'Vignette',
    icon: 'FrameCorners',
    type: 'uber',
    params: [{ key: 'vignette', label: 'Vignette', min: 0, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'fade',
    label: 'Fade',
    icon: 'CircleDashed',
    type: 'uber',
    params: [{ key: 'fade', label: 'Fade', min: 0, max: 100, default: 0, step: 1 }],
  },
  {
    id: 'blur',
    label: 'Blur',
    icon: 'CircleNotch',
    type: 'blur',
    params: [{ key: 'blur_amount', label: 'Amount', min: 0, max: 100, default: 0, step: 1 }],
  },
];

export const ADJUST_TOOL_MAP = new Map(ADJUST_TOOLS.map((t) => [t.id, t]));

export const DEFAULT_BLUR_PARAMS: BlurParams = {
  amount: 0,
  center: [0.5, 0.5],
  mode: 'circular',
  angle: 0,
};

export function isUberActive(params: AdjustParams): boolean {
  return (
    (params.exposure ?? 0) !== 0 ||
    (params.brightness ?? 0) !== 0 ||
    (params.contrast ?? 0) !== 0 ||
    (params.highlights ?? 0) !== 0 ||
    (params.shadows ?? 0) !== 0 ||
    (params.saturation ?? 0) !== 0 ||
    (params.temperature ?? 0) !== 0 ||
    (params.tint ?? 0) !== 0 ||
    (params.vignette ?? 0) !== 0 ||
    (params.fade ?? 0) !== 0
  );
}

export function isSharpenActive(params: AdjustParams): boolean {
  return (params.sharpen ?? 0) !== 0;
}

export function isGrainActive(params: AdjustParams): boolean {
  return (params.grain_strength ?? 0) !== 0;
}

export function isAdjustActive(params: AdjustParams): boolean {
  return isUberActive(params) || isSharpenActive(params) || isGrainActive(params);
}
