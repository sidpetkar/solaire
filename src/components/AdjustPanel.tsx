import { useState } from 'react';
import {
  Sun, SunDim, SunHorizon, CircleHalf, Drop, Thermometer, Diamond,
  DotsNine, FrameCorners, CircleDashed, CircleNotch,
  Crop, Check, X,
} from '@phosphor-icons/react';
import { ADJUST_TOOLS, type AdjustParams, type BlurParams, DEFAULT_BLUR_PARAMS } from '../engine/adjustments';
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
}: Props) {
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [pendingParams, setPendingParams] = useState<AdjustParams>({});
  const [pendingBlur, setPendingBlur] = useState<BlurParams>(DEFAULT_BLUR_PARAMS);
  const [savedParams, setSavedParams] = useState<AdjustParams>({});
  const [savedBlur, setSavedBlur] = useState<BlurParams>(DEFAULT_BLUR_PARAMS);

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

  // Editing a tool: show sliders + confirm/cancel
  if (editingDef && editingTool) {
    if (editingDef.type === 'blur') {
      return (
        <div className="animate-panel-fade max-w-[600px] mx-auto w-full">
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
      );
    }

    return (
      <div className="animate-panel-fade max-w-[600px] mx-auto w-full">
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
    );
  }

  // Tool strip (horizontal, separated by dividers)
  return (
    <div className="animate-panel-fade">
      <div className="flex px-1 overflow-x-auto md:justify-center items-center" style={{ height: STRIP_HEIGHT, touchAction: 'pan-x' }}>
        {ADJUST_TOOLS.map((tool, i) => {
          const active = isToolActive(tool.id);
          return (
            <button
              key={tool.id}
              onClick={() => openTool(tool.id)}
              className={`shrink-0 flex flex-col items-center justify-center gap-1.5 ${
                i < ADJUST_TOOLS.length - 1 ? 'border-r border-white/8' : ''
              }`}
              style={{ width: TILE_SIZE, height: 68 }}
            >
              <span className={active ? 'text-amber-400' : 'text-accent/70'}>
                {ICON_MAP[tool.icon] ?? <Sun size={22} weight="duotone" />}
              </span>
              <span
                className={`text-[10px] tracking-wider font-light ${
                  active ? 'text-amber-400' : 'text-accent/70'
                }`}
              >
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
