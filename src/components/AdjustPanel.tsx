import { useState, useRef, useEffect } from 'react';
import {
  Sun, SunDim, SunHorizon, CircleHalf, Drop, Thermometer, Diamond,
  DotsNine, FrameCorners, CircleDashed, CircleNotch,
  Crop, Check, X, FilmStrip, Aperture, Rainbow,
} from '@phosphor-icons/react';
import { ADJUST_TOOLS, type AdjustParams, type BlurParams, DEFAULT_BLUR_PARAMS } from '../engine/adjustments';
import { EFFECTS, getDefaultValues, type EffectParams, type EffectValues } from '../engine/effects';
import type { ReactElement } from 'react';

const ICON_MAP: Record<string, ReactElement> = {
  Sun: <Sun size={22} weight="duotone" />,
  SunDim: <SunDim size={22} weight="duotone" />,
  SunHorizon: <SunHorizon size={22} weight="duotone" />,
  CircleHalf: <CircleHalf size={22} weight="duotone" />,
  Drop: <Drop size={22} weight="duotone" />,
  Thermometer: <Thermometer size={22} weight="duotone" />,
  Diamond: <Diamond size={22} weight="duotone" />,
  DotsNine: <DotsNine size={22} weight="duotone" />,
  FrameCorners: <FrameCorners size={22} weight="duotone" />,
  CircleDashed: <CircleDashed size={22} weight="duotone" />,
  CircleNotch: <CircleNotch size={22} weight="duotone" />,
  Crop: <Crop size={22} weight="duotone" />,
  GrainSlash: <FilmStrip size={22} weight="duotone" />,
  LensDistort: <Aperture size={22} weight="duotone" />,
  ChromaticAb: <Rainbow size={22} weight="duotone" />,
};

const TILE_SIZE = 76;
const STRIP_HEIGHT = 92;

interface Props {
  adjustParams: AdjustParams;
  blurParams: BlurParams;
  onChange: (params: AdjustParams) => void;
  onBlurChange: (params: BlurParams) => void;
  onCommit: () => void;
  onCropOpen: () => void;
  onBlurActiveChange: (active: boolean) => void;
  onEditingChange?: (editing: boolean) => void;
  activeEffects?: EffectParams;
  onEffectsChange?: (params: EffectParams) => void;
}

export default function AdjustPanel({
  adjustParams,
  blurParams,
  onChange,
  onBlurChange,
  onCommit,
  onCropOpen,
  onBlurActiveChange,
  onEditingChange,
  activeEffects = {},
  onEffectsChange,
}: Props) {
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [pendingParams, setPendingParams] = useState<AdjustParams>({});
  const [pendingBlur, setPendingBlur] = useState<BlurParams>(DEFAULT_BLUR_PARAMS);
  const [savedParams, setSavedParams] = useState<AdjustParams>({});
  const [savedBlur, setSavedBlur] = useState<BlurParams>(DEFAULT_BLUR_PARAMS);

  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [editingTool]);

  // FX editing state
  const [editingFx, setEditingFx] = useState<string | null>(null);
  const [pendingFxValues, setPendingFxValues] = useState<EffectValues>({});
  const [savedEffects, setSavedEffects] = useState<EffectParams>({});

  const editingFxDef = editingFx ? EFFECTS.find((e) => e.id === editingFx) : null;

  const editingDef = editingTool
    ? ADJUST_TOOLS.find((t) => t.id === editingTool)
    : null;

  function isToolActive(toolId: string): boolean {
    const def = ADJUST_TOOLS.find((t) => t.id === toolId);
    if (!def) return false;
    if (toolId === 'blur') return blurParams.amount > 0;
    for (const p of def.params) {
      if ((adjustParams[p.key] ?? p.default) !== p.default) return true;
    }
    return false;
  }

  function openTool(toolId: string) {
    const def = ADJUST_TOOLS.find((t) => t.id === toolId);
    if (!def) return;

    if (def.type === 'overlay') {
      onCropOpen();
      return;
    }

    if (def.type === 'blur') {
      setSavedBlur({ ...blurParams });
      setPendingBlur({ ...blurParams });
      onBlurActiveChange(true);
      setEditingTool(toolId);
      onEditingChange?.(true);
      return;
    }

    setSavedParams({ ...adjustParams });
    setPendingParams({ ...adjustParams });
    setEditingTool(toolId);
    onEditingChange?.(true);
  }

  function handleSliderChange(key: string, value: number) {
    const updated = { ...pendingParams, [key]: value };
    setPendingParams(updated);
    onChange(updated);
  }

  function handleBlurAmountChange(value: number) {
    const updated: BlurParams = { ...pendingBlur, amount: value };
    setPendingBlur(updated);
    onBlurChange(updated);
  }

  function handleBlurModeToggle(mode: 'circular' | 'linear') {
    const updated: BlurParams = { ...pendingBlur, mode };
    setPendingBlur(updated);
    onBlurChange(updated);
  }

  function confirmEdit() {
    if (editingDef?.type === 'blur') {
      onBlurActiveChange(false);
    }
    onCommit();
    setEditingTool(null);
    onEditingChange?.(false);
  }

  function cancelEdit() {
    if (editingDef?.type === 'blur') {
      onBlurChange(savedBlur);
      onBlurActiveChange(false);
    } else {
      onChange(savedParams);
    }
    setEditingTool(null);
    onEditingChange?.(false);
  }

  // --- FX tools integrated into adjust strip ---
  const fxIconMap: Record<string, string> = {
    grain: 'GrainSlash',
    'lens-distortion': 'LensDistort',
    'chromatic-aberration': 'ChromaticAb',
  };

  function isFxActive(fxId: string): boolean {
    return !!activeEffects[fxId];
  }

  function openFx(fxId: string) {
    const def = EFFECTS.find((e) => e.id === fxId);
    if (!def) return;
    setSavedEffects({ ...activeEffects });
    const current = activeEffects[fxId] ?? getDefaultValues(fxId);
    setPendingFxValues({ ...current });
    setEditingFx(fxId);
    if (!activeEffects[fxId]) {
      onEffectsChange?.({ ...activeEffects, [fxId]: { ...current } });
    }
    onEditingChange?.(true);
  }

  function handleFxSliderChange(key: string, value: number) {
    const updated = { ...pendingFxValues, [key]: value };
    setPendingFxValues(updated);
    onEffectsChange?.({ ...activeEffects, [editingFx!]: updated });
  }

  function confirmFx() {
    setEditingFx(null);
    onEditingChange?.(false);
  }

  function cancelFx() {
    onEffectsChange?.(savedEffects);
    setEditingFx(null);
    onEditingChange?.(false);
  }

  function toggleFxOff() {
    if (editingFx) {
      const restored = { ...activeEffects };
      delete restored[editingFx];
      onEffectsChange?.(restored);
    }
    setEditingFx(null);
    onEditingChange?.(false);
  }

  const allItems = [
    ...ADJUST_TOOLS.map((tool) => ({
      id: tool.id,
      label: tool.label,
      icon: tool.icon,
      active: isToolActive(tool.id),
      type: 'adjust' as const,
    })),
    ...EFFECTS.map((fx) => ({
      id: fx.id,
      label: fx.label,
      icon: fxIconMap[fx.id] ?? fx.icon,
      active: isFxActive(fx.id),
      type: 'fx' as const,
    })),
  ];

  return (
    <div>
      {editingFxDef && editingFx ? (
        <div className="max-w-[600px] mx-auto w-full">
          <div
            className="px-4 space-y-3 animate-panel-slide-up flex flex-col justify-center"
            style={{ minHeight: STRIP_HEIGHT }}
          >
            {editingFxDef.params.map((p) => (
              <div key={p.key} className="flex items-center gap-3">
                <span className="text-[11px] text-muted tracking-wider w-16 shrink-0 text-right">
                  {p.label}
                </span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={pendingFxValues[p.key] ?? p.default}
                  onChange={(e) => handleFxSliderChange(p.key, Number(e.target.value))}
                  className="flex-1 accent-amber-400 h-1"
                />
                <span className="text-[11px] text-muted tracking-wider w-8 shrink-0">
                  {Math.round(pendingFxValues[p.key] ?? p.default)}
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex items-center justify-between px-4 py-4 border-t border-white/5 animate-panel-slide-up"
            style={{ animationDelay: '0.05s' }}
          >
            <button onClick={toggleFxOff} className="text-accent/80 p-1">
              <X size={22} weight="bold" />
            </button>
            <span className="text-[12px] tracking-widest text-amber-400 font-medium uppercase">
              {editingFxDef.label}
            </span>
            <button onClick={confirmFx} className="text-accent p-1">
              <Check size={22} weight="bold" />
            </button>
          </div>
        </div>
      ) : editingDef && editingTool && editingDef.type === 'blur' ? (
        <div className="max-w-[600px] mx-auto w-full">
          <div
            className="px-4 space-y-3 animate-panel-slide-up flex flex-col justify-center"
            style={{ minHeight: STRIP_HEIGHT }}
          >
            <div className="flex justify-center gap-4 mb-2">
              <button
                onClick={() => handleBlurModeToggle('circular')}
                className={`text-[11px] tracking-wider px-3 py-1 rounded-full transition-colors ${
                  pendingBlur.mode === 'circular'
                    ? 'bg-amber-400/20 text-amber-400'
                    : 'text-muted/60'
                }`}
              >
                Circular
              </button>
              <button
                onClick={() => handleBlurModeToggle('linear')}
                className={`text-[11px] tracking-wider px-3 py-1 rounded-full transition-colors ${
                  pendingBlur.mode === 'linear'
                    ? 'bg-amber-400/20 text-amber-400'
                    : 'text-muted/60'
                }`}
              >
                Linear
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted tracking-wider w-16 shrink-0 text-right">
                Amount
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={pendingBlur.amount}
                onChange={(e) => handleBlurAmountChange(Number(e.target.value))}
                className="flex-1 accent-amber-400 h-1"
              />
              <span className="text-[11px] text-muted tracking-wider w-8 shrink-0">
                {Math.round(pendingBlur.amount)}
              </span>
            </div>
          </div>
          <div
            className="flex items-center justify-between px-4 py-4 border-t border-white/5 animate-panel-slide-up"
            style={{ animationDelay: '0.05s' }}
          >
            <button onClick={cancelEdit} className="text-accent/80 p-1">
              <X size={22} weight="bold" />
            </button>
            <span className="text-[12px] tracking-widest text-amber-400 font-medium uppercase">
              {editingDef.label}
            </span>
            <button onClick={confirmEdit} className="text-accent p-1">
              <Check size={22} weight="bold" />
            </button>
          </div>
        </div>
      ) : editingDef && editingTool ? (
        <div className="max-w-[600px] mx-auto w-full">
          <div
            className="px-4 space-y-3 animate-panel-slide-up flex flex-col justify-center"
            style={{ minHeight: STRIP_HEIGHT }}
          >
            {editingDef.params.map((p) => (
              <div key={p.key} className="flex items-center gap-3">
                <span className="text-[11px] text-muted tracking-wider w-16 shrink-0 text-right">
                  {p.label}
                </span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={pendingParams[p.key] ?? p.default}
                  onChange={(e) => handleSliderChange(p.key, Number(e.target.value))}
                  className="flex-1 accent-amber-400 h-1"
                />
                <span className="text-[11px] text-muted tracking-wider w-8 shrink-0">
                  {Math.round(pendingParams[p.key] ?? p.default)}
                </span>
              </div>
            ))}
          </div>
          <div
            className="flex items-center justify-between px-4 py-4 border-t border-white/5 animate-panel-slide-up"
            style={{ animationDelay: '0.05s' }}
          >
            <button onClick={cancelEdit} className="text-accent/80 p-1">
              <X size={22} weight="bold" />
            </button>
            <span className="text-[12px] tracking-widest text-amber-400 font-medium uppercase">
              {editingDef.label}
            </span>
            <button onClick={confirmEdit} className="text-accent p-1">
              <Check size={22} weight="bold" />
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={stripRef}
          className="flex px-1 overflow-x-auto items-center"
          style={{ height: STRIP_HEIGHT, touchAction: 'pan-x' }}
        >
          <div className="flex items-center mx-auto">
            {allItems.map((item, i) => (
              <button
                key={item.id + '-' + item.type}
                onClick={() => item.type === 'fx' ? openFx(item.id) : openTool(item.id)}
                className={`shrink-0 flex flex-col items-center justify-center gap-1.5 ${
                  i < allItems.length - 1 ? 'border-r border-white/8' : ''
                }`}
                style={{ width: TILE_SIZE, height: 68 }}
              >
                <span className={item.active ? 'text-amber-400' : 'text-accent/70'}>
                  {ICON_MAP[item.icon] ?? <Sun size={22} weight="duotone" />}
                </span>
                <span
                  className={`text-[10px] tracking-wider font-light ${
                    item.active ? 'text-amber-400' : 'text-accent/70'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
