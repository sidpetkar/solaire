import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  getAllLUTs, getLUTsByCategory, loadLUT,
  generateThumbnail, getThumbLUT, isThumbBundleReady,
} from '../engine/lutManager';
import type { LUTMeta, ParsedLUT } from '../types';

interface Props {
  activeTab: string;
  activeLutId: string | null;
  onSelect: (meta: LUTMeta, parsed: ParsedLUT) => void;
  onClear: () => void;
  onDoubleTapSelected?: () => void;
  sourceImage?: HTMLImageElement | null;
  lutsReady?: boolean;
  prefsKey?: number;
}

const MAX_VISIBLE = 50;
const THUMB_SIZE = 76;
const DOUBLE_TAP_MS = 350;
const BATCH_SIZE = 6;

const thumbCache = new Map<string, string>();

function centerCropDataUrl(source: HTMLImageElement, size: number): string {
  const sw = source.naturalWidth;
  const sh = source.naturalHeight;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.6);
}

export default function FilterStrip({ activeTab, activeLutId, onSelect, onClear, onDoubleTapSelected, sourceImage, lutsReady, prefsKey }: Props) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [ogThumbUrl, setOgThumbUrl] = useState<string | null>(null);
  const genIdRef = useRef(0);
  const prevSrcRef = useRef<string | null>(null);
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const tapSeqRef = useRef(0);

  const srcKey = sourceImage?.src ?? null;
  if (srcKey !== prevSrcRef.current) {
    prevSrcRef.current = srcKey;
    thumbCache.clear();
    if (sourceImage) {
      setOgThumbUrl(centerCropDataUrl(sourceImage, THUMB_SIZE));
    } else {
      setOgThumbUrl(null);
    }
  }

  const luts = useMemo(() => {
    if (!lutsReady) return [];
    const category = activeTab === 'all presets' ? 'all' : activeTab;
    const filtered = category === 'all' ? getAllLUTs() : getLUTsByCategory(category);
    return filtered.slice(0, MAX_VISIBLE);
  }, [activeTab, lutsReady, prefsKey]);

  useEffect(() => {
    if (!sourceImage || luts.length === 0) return;

    const id = ++genIdRef.current;

    const cached = new Map<string, string>();
    for (const lut of luts) {
      const c = thumbCache.get(lut.id);
      if (c) cached.set(lut.id, c);
    }
    if (cached.size > 0) setThumbnails(new Map(cached));

    const pending = luts.filter((l) => !thumbCache.has(l.id));
    if (pending.length === 0) return;

    let cancelled = false;
    const useBundledThumbs = isThumbBundleReady();

    async function genBatch() {
      const batch = new Map(cached);

      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        if (cancelled || genIdRef.current !== id) break;

        const chunk = pending.slice(i, i + BATCH_SIZE);

        // Load LUT data in parallel (network I/O)
        const loaded = await Promise.allSettled(
          chunk.map(async (lut) => {
            let parsed: ParsedLUT;
            if (useBundledThumbs) {
              const thumbLut = getThumbLUT(lut);
              parsed = thumbLut ?? await loadLUT(lut);
            } else {
              parsed = await loadLUT(lut);
            }
            return { meta: lut, parsed };
          }),
        );

        // Render thumbnails sequentially (single shared WebGL context)
        for (const r of loaded) {
          if (cancelled || genIdRef.current !== id) break;
          if (r.status !== 'fulfilled') continue;
          const { meta, parsed } = r.value;
          try {
            const dataUrl = await generateThumbnail(sourceImage!, parsed, THUMB_SIZE);
            thumbCache.set(meta.id, dataUrl);
            batch.set(meta.id, dataUrl);
          } catch { /* skip failed thumbnail */ }
        }

        if (!cancelled && genIdRef.current === id) {
          setThumbnails(new Map(batch));
        }
      }
    }

    genBatch();
    return () => { cancelled = true; };
  }, [sourceImage, luts]);

  const handleLutTap = useCallback(async (lut: LUTMeta) => {
    const now = Date.now();
    const last = lastTapRef.current;

    if (activeLutId === lut.id && last.id === lut.id && now - last.time < DOUBLE_TAP_MS) {
      lastTapRef.current = { id: '', time: 0 };
      onDoubleTapSelected?.();
      return;
    }

    lastTapRef.current = { id: lut.id, time: now };

    const seq = ++tapSeqRef.current;
    try {
      const parsed = await loadLUT(lut);
      if (tapSeqRef.current !== seq) return;
      onSelect(lut, parsed);
    } catch (e) {
      console.warn('[FilterStrip] Failed to load LUT:', lut.id, e);
    }
  }, [activeLutId, onSelect, onDoubleTapSelected]);

  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div ref={stripRef} className="flex gap-1 px-4 overflow-x-auto items-center" style={{ height: 92, touchAction: 'pan-x' }}>
      <button
        onClick={onClear}
        className="shrink-0"
      >
        <div
          className={`relative overflow-hidden bg-surface-lighter flex items-center justify-center ${
            !activeLutId ? 'ring-2 ring-amber-400' : ''
          }`}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
        >
          {sourceImage ? (
            <img
              src={ogThumbUrl ?? undefined}
              alt="Original"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[9px] text-muted tracking-wider">OG</span>
          )}
          <div
            className={`absolute bottom-0 inset-x-0 flex items-center justify-center py-0.5 ${
              !activeLutId ? 'bg-amber-400' : 'bg-black/50'
            }`}
          >
            <span
              className={`text-[10px] font-medium tracking-wider ${
                !activeLutId ? 'text-surface' : 'text-white/70'
              }`}
            >
              OG
            </span>
          </div>
        </div>
      </button>

      {luts.map((lut) => {
        const isActive = activeLutId === lut.id;
        return (
          <button
            key={lut.id}
            onClick={() => handleLutTap(lut)}
            className="shrink-0"
          >
            <div
              className={`relative overflow-hidden bg-surface-lighter ${
                isActive ? 'ring-2 ring-amber-400' : ''
              }`}
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            >
              {thumbnails.get(lut.id) ? (
                <img
                  src={thumbnails.get(lut.id)}
                  alt={lut.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center px-1">
                  <span className="text-[7px] text-muted text-center leading-tight">{lut.name}</span>
                </div>
              )}
              <div
                className={`absolute bottom-0 inset-x-0 flex items-center justify-center py-0.5 ${
                  isActive ? 'bg-amber-400' : 'bg-black/50'
                }`}
              >
                <span
                  className={`text-[12px] font-medium leading-tight text-center px-0.5 ${
                    isActive ? 'text-surface' : 'text-white/70'
                  }`}
                >
                  {lut.name}
                </span>
              </div>
            </div>
          </button>
        );
      })}

      {luts.length === 0 && (
        <div className="flex items-center justify-center w-full py-4">
          <span className="text-[10px] text-muted tracking-wider">
            {lutsReady ? 'No LUTs in this category' : 'Loading filters\u2026'}
          </span>
        </div>
      )}
    </div>
  );
}
