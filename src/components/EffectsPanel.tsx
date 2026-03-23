import { useState } from 'react';
import { FilmStrip, Aperture, Rainbow, Check, X } from '@phosphor-icons/react';
import { EFFECTS, getDefaultValues, type EffectParams, type EffectValues } from '../engine/effects';
import type { ReactElement } from 'react';

const ICON_MAP: Record<string, ReactElement> = {
  GrainSlash: <FilmStrip size={24} weight="duotone" />,
  CircleHalf: <Aperture size={24} weight="duotone" />,
  Rainbow: <Rainbow size={24} weight="duotone" />,
};

const FX_STRIP_HEIGHT = 101;

interface Props {
  activeEffects: EffectParams;
  onChange: (params: EffectParams) => void;
  onEditingChange?: (editing: boolean) => void;
}

export default function EffectsPanel({ activeEffects, onChange, onEditingChange }: Props) {
  const [editingEffect, setEditingEffect] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<EffectValues>({});

  const editingDef = editingEffect
    ? EFFECTS.find((e) => e.id === editingEffect)
    : null;

  function handleTilePress(effectId: string) {
    if (activeEffects[effectId]) {
      setEditingEffect(effectId);
      setPendingValues({ ...activeEffects[effectId] });
      onEditingChange?.(true);
    } else {
      const defaults = getDefaultValues(effectId);
      const next = { ...activeEffects, [effectId]: defaults };
      onChange(next);
      setEditingEffect(effectId);
      setPendingValues(defaults);
      onEditingChange?.(true);
    }
  }

  function handleToggleOff(effectId: string) {
    const next = { ...activeEffects };
    delete next[effectId];
    onChange(next);
    if (editingEffect === effectId) {
      setEditingEffect(null);
    }
  }

  function handleParamChange(key: string, value: number) {
    const updated = { ...pendingValues, [key]: value };
    setPendingValues(updated);
    if (editingEffect) {
      onChange({ ...activeEffects, [editingEffect]: updated });
    }
  }

  function confirmEdit() {
    if (editingEffect) {
      onChange({ ...activeEffects, [editingEffect]: pendingValues });
    }
    setEditingEffect(null);
    onEditingChange?.(false);
  }

  function cancelEdit() {
    setEditingEffect(null);
    onEditingChange?.(false);
  }

  if (editingDef && editingEffect) {
    return (
      <div className="animate-panel-fade">
        <div
          className="px-5 space-y-3 animate-panel-slide-up flex flex-col justify-center"
          style={{ minHeight: FX_STRIP_HEIGHT }}
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
                value={pendingValues[p.key] ?? p.default}
                onChange={(e) => handleParamChange(p.key, Number(e.target.value))}
                className="flex-1 accent-amber-400 h-1"
              />
              <span className="text-[11px] text-muted tracking-wider w-8 shrink-0">
                {Math.round(pendingValues[p.key] ?? p.default)}
              </span>
            </div>
          ))}
        </div>
        <div
          className="flex items-center justify-between px-5 py-5 border-t border-white/5 animate-panel-slide-up"
          style={{ animationDelay: '0.05s' }}
        >
          <button onClick={cancelEdit} className="text-accent/80 p-1">
            <X size={22} weight="bold" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[12px] tracking-widest text-amber-400 font-medium">
              {editingDef.label}
            </span>
            <button
              onClick={() => handleToggleOff(editingEffect)}
              className="text-[10px] tracking-wider text-red-400/80 border border-red-400/30 rounded px-2 py-0.5"
            >
              OFF
            </button>
          </div>
          <button onClick={confirmEdit} className="text-accent p-1">
            <Check size={22} weight="bold" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-panel-fade">
      <div
        className="grid grid-cols-3 gap-2 px-4 items-center"
        style={{ height: FX_STRIP_HEIGHT }}
      >
        {EFFECTS.map((fx) => {
          const isActive = !!activeEffects[fx.id];
          return (
            <button
              key={fx.id}
              onClick={() => handleTilePress(fx.id)}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-lg py-3 px-2 transition-all ${
                isActive
                  ? 'bg-white/10 ring-1 ring-amber-400/50'
                  : 'bg-white/[0.03] active:bg-white/10'
              }`}
            >
              <span className={isActive ? 'text-amber-400' : 'text-muted/60'}>
                {ICON_MAP[fx.icon] ?? <FilmStrip size={24} weight="duotone" />}
              </span>
              <span
                className={`text-[10px] tracking-wider ${
                  isActive ? 'text-amber-400' : 'text-muted/60'
                }`}
              >
                {fx.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
