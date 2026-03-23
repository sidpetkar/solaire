import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowUUpLeft, ArrowUUpRight, Trash, Check, X } from '@phosphor-icons/react';
import ScreenShell from '../components/ScreenShell';
import ScreenHeader from '../components/ScreenHeader';
import WebGLCanvas, { type WebGLCanvasHandle } from '../components/WebGLCanvas';
import FolderTabs from '../components/FolderTabs';
import FilterStrip from '../components/FilterStrip';
import EffectsPanel from '../components/EffectsPanel';
import AdjustPanel from '../components/AdjustPanel';
import CropTool from '../components/CropTool';
import SaveModal from '../components/SaveModal';
import { useImageStore, downloadBlob } from '../hooks/useImageStore';
import { useCategoryPrefs } from '../hooks/useCategoryPrefs';
import { useWatermarkPref } from '../hooks/useWatermarkPref';
import { applyWatermark } from '../engine/watermark';
import { initLUTs } from '../engine/lutManager';
import { DEFAULT_BLUR_PARAMS, type AdjustParams, type BlurParams } from '../engine/adjustments';
import type { LUTMeta, ParsedLUT } from '../types';
import type { EffectParams } from '../engine/effects';

type EditorPanel = 'filters' | 'effects' | 'adjust';

interface HistoryEntry {
  lutId: string | null;
  meta: LUTMeta | null;
  parsed: ParsedLUT | null;
  effectParams: EffectParams;
  adjustParams: AdjustParams;
  blurParams: BlurParams;
}

export default function EditScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasHandle = useRef<WebGLCanvasHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('all presets');
  const [activeLutId, setActiveLutId] = useState<string | null>(null);
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lutsReady, setLutsReady] = useState(false);
  const { saveImage, getFullImage, deleteImage } = useImageStore();
  const { disabledCategories } = useCategoryPrefs();
  const prefsKey = disabledCategories.size;
  const { watermarkEnabled } = useWatermarkPref();

  const [activePanel, setActivePanel] = useState<EditorPanel>('filters');

  const [effectParams, setEffectParams] = useState<EffectParams>({});
  const [adjustParams, setAdjustParams] = useState<AdjustParams>({});
  const [blurParams, setBlurParams] = useState<BlurParams>({ ...DEFAULT_BLUR_PARAMS });
  const [cropActive, setCropActive] = useState(false);
  const [blurActive, setBlurActive] = useState(false);
  const [adjustEditing, setAdjustEditing] = useState(false);
  const [effectsEditing, setEffectsEditing] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([
    { lutId: null, meta: null, parsed: null, effectParams: {}, adjustParams: {}, blurParams: { ...DEFAULT_BLUR_PARAMS } },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [strengthMode, setStrengthMode] = useState(false);
  const [filterStrength, setFilterStrength] = useState(100);
  const [pendingStrength, setPendingStrength] = useState(100);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const activeEntry = history[historyIndex];
  const activeLutShortCode = activeEntry?.meta?.shortCode ?? '';

  const state = location.state as { imageUrl?: string; imageId?: string } | null;
  const existingId = state?.imageId ?? undefined;

  useEffect(() => {
    initLUTs().then(() => setLutsReady(true));
  }, []);

  const renderToCanvas = useCallback((img: HTMLImageElement) => {
    const tryRender = (attempt = 0) => {
      const handle = canvasHandle.current;
      if (!handle?.renderer || !handle.canvas) {
        if (attempt < 15) requestAnimationFrame(() => tryRender(attempt + 1));
        return;
      }

      const container = containerRef.current;
      const maxW = container ? container.clientWidth - 32 : 800;
      const maxH = container ? container.clientHeight - 32 : 600;
      const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);

      handle.canvas.width = img.naturalWidth;
      handle.canvas.height = img.naturalHeight;
      handle.canvas.style.width = `${Math.round(img.naturalWidth * scale)}px`;
      handle.canvas.style.height = `${Math.round(img.naturalHeight * scale)}px`;

      handle.renderer.uploadImage(img);
      handle.renderer.render();
      setLoaded(true);
    };
    requestAnimationFrame(() => tryRender());
  }, []);

  useEffect(() => {
    if (!state) return;
    let cancelled = false;

    async function load() {
      let url = state!.imageUrl;
      if (!url && state!.imageId) {
        const blob = await getFullImage(state!.imageId);
        if (blob) url = URL.createObjectURL(blob);
      }
      if (!url || cancelled) return;

      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setSourceImg(img);
        renderToCanvas(img);
      };
      img.src = url;
    }

    load();
    return () => { cancelled = true; };
  }, [state, getFullImage, renderToCanvas]);

  const applyHistoryEntry = useCallback((entry: HistoryEntry) => {
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;

    handle.renderer.setEffects(entry.effectParams);
    handle.renderer.setAdjustments(entry.adjustParams);
    handle.renderer.setBlur(entry.blurParams.amount > 0 ? entry.blurParams : null);
    setEffectParams(entry.effectParams);
    setAdjustParams(entry.adjustParams);
    setBlurParams(entry.blurParams);

    if (entry.parsed) {
      handle.renderer.uploadLUT(entry.parsed);
    } else {
      handle.renderer.clearLUT();
    }
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();
  }, [sourceImg]);

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, entry];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleSelectLUT = useCallback((meta: LUTMeta, parsed: ParsedLUT) => {
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;

    handle.renderer.setIntensity(1.0);
    setFilterStrength(100);

    handle.renderer.uploadLUT(parsed);
    if (sourceImg) handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();

    pushHistory({ lutId: meta.id, meta, parsed, effectParams, adjustParams, blurParams });
    setActiveLutId(meta.id);
  }, [sourceImg, pushHistory, effectParams, adjustParams, blurParams]);

  const handleClearLUT = useCallback(() => {
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;

    handle.renderer.setIntensity(1.0);
    setFilterStrength(100);

    handle.renderer.clearLUT();
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();

    pushHistory({ lutId: null, meta: null, parsed: null, effectParams, adjustParams, blurParams });
    setActiveLutId(null);
  }, [sourceImg, pushHistory, effectParams, adjustParams, blurParams]);

  const handleEffectsChange = useCallback((params: EffectParams) => {
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;

    setEffectParams(params);
    handle.renderer.setEffects(params);
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();
  }, [sourceImg]);

  const commitEffects = useCallback((params: EffectParams) => {
    pushHistory({
      lutId: activeLutId,
      meta: activeEntry?.meta ?? null,
      parsed: activeEntry?.parsed ?? null,
      effectParams: params,
      adjustParams,
      blurParams,
    });
  }, [pushHistory, activeLutId, activeEntry, adjustParams, blurParams]);

  const handleAdjustChange = useCallback((params: AdjustParams) => {
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;
    setAdjustParams(params);
    handle.renderer.setAdjustments(params);
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();
  }, [sourceImg]);

  const handleBlurChange = useCallback((params: BlurParams) => {
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;
    setBlurParams(params);
    handle.renderer.setBlur(params.amount > 0 ? params : null);
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();
  }, [sourceImg]);

  const commitAdjust = useCallback(() => {
    pushHistory({
      lutId: activeLutId,
      meta: activeEntry?.meta ?? null,
      parsed: activeEntry?.parsed ?? null,
      effectParams,
      adjustParams,
      blurParams,
    });
  }, [pushHistory, activeLutId, activeEntry, effectParams, adjustParams, blurParams]);

  const handleCropConfirm = useCallback((croppedImg: HTMLImageElement) => {
    setCropActive(false);
    setSourceImg(croppedImg);
    renderToCanvas(croppedImg);
    const handle = canvasHandle.current;
    if (handle?.renderer) {
      handle.renderer.uploadImage(croppedImg);
      handle.renderer.render();
    }
  }, [renderToCanvas]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const newIndex = historyIndex - 1;
    const entry = history[newIndex];
    applyHistoryEntry(entry);
    setHistoryIndex(newIndex);
    setActiveLutId(entry.lutId);
  }, [canUndo, historyIndex, history, applyHistoryEntry]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    const entry = history[newIndex];
    applyHistoryEntry(entry);
    setHistoryIndex(newIndex);
    setActiveLutId(entry.lutId);
  }, [canRedo, historyIndex, history, applyHistoryEntry]);

  const handleDeleteImage = useCallback(async () => {
    if (existingId) {
      await deleteImage(existingId);
    }
    navigate('/');
  }, [existingId, deleteImage, navigate]);

  const handleSave = useCallback(() => {
    if (!watermarkEnabled) {
      handleConfirmSave(false);
      return;
    }
    setShowSaveModal(true);
  }, [watermarkEnabled]);

  const handleConfirmSave = useCallback(async (withWatermark: boolean) => {
    setShowSaveModal(false);
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    try {
      if (sourceImg) handle.renderer.uploadImage(sourceImg);
      const blob = await handle.renderer.toBlob();
      const id = await saveImage(blob, activeLutId ?? undefined, existingId);
      const filename = `KAPTURA_${id}.jpg`;

      if (withWatermark && watermarkEnabled) {
        const wmBlob = await applyWatermark(blob);
        downloadBlob(wmBlob, filename);
      } else {
        downloadBlob(blob, filename);
      }
      navigate('/');
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [activeLutId, saveImage, navigate, sourceImg, existingId, watermarkEnabled]);

  const enterStrengthMode = useCallback(() => {
    if (!activeLutId) return;
    setPendingStrength(filterStrength);
    setStrengthMode(true);
  }, [activeLutId, filterStrength]);

  const handleStrengthChange = useCallback((value: number) => {
    setPendingStrength(value);
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;
    handle.renderer.setIntensity(value / 100);
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();
  }, [sourceImg]);

  const confirmStrength = useCallback(() => {
    setFilterStrength(pendingStrength);
    setStrengthMode(false);
  }, [pendingStrength]);

  const cancelStrength = useCallback(() => {
    const handle = canvasHandle.current;
    if (handle?.renderer && sourceImg) {
      handle.renderer.setIntensity(filterStrength / 100);
      handle.renderer.uploadImage(sourceImg);
      handle.renderer.render();
    }
    setPendingStrength(filterStrength);
    setStrengthMode(false);
  }, [filterStrength, sourceImg]);

  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPeekingRef = useRef(false);

  const handlePeekDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    peekTimerRef.current = setTimeout(() => {
      const handle = canvasHandle.current;
      if (!handle?.renderer || !sourceImg) return;
      isPeekingRef.current = true;
      handle.renderer.clearLUT();
      handle.renderer.setEffects({});
      handle.renderer.setAdjustments({});
      handle.renderer.setBlur(null);
      handle.renderer.setIntensity(1.0);
      handle.renderer.uploadImage(sourceImg);
      handle.renderer.render();
    }, 300);
  }, [sourceImg]);

  const handlePeekUp = useCallback(() => {
    if (peekTimerRef.current) {
      clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
    if (!isPeekingRef.current) return;
    isPeekingRef.current = false;

    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;

    const entry = history[historyIndex];
    handle.renderer.setEffects(entry.effectParams);
    handle.renderer.setAdjustments(entry.adjustParams);
    handle.renderer.setBlur(entry.blurParams.amount > 0 ? entry.blurParams : null);
    handle.renderer.setIntensity(filterStrength / 100);
    if (entry.parsed) {
      handle.renderer.uploadLUT(entry.parsed);
    }
    handle.renderer.uploadImage(sourceImg);
    handle.renderer.render();
  }, [sourceImg, history, historyIndex, filterStrength]);

  return (
    <ScreenShell>
      <ScreenHeader
        left={
          <button onClick={() => navigate(-1)} className="text-base tracking-widest text-accent/80">
            Back
          </button>
        }
        center={
          <div className="flex items-center gap-2">
            {history.length > 1 ? (
              <>
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`p-1 transition-opacity ${canUndo ? 'text-accent' : 'text-accent/30'}`}
                >
                  <ArrowUUpLeft size={20} weight="bold" />
                </button>
                <button
                  onClick={handleDeleteImage}
                  className="p-1 text-accent"
                >
                  <Trash size={20} weight="bold" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`p-1 transition-opacity ${canRedo ? 'text-accent' : 'text-accent/30'}`}
                >
                  <ArrowUUpRight size={20} weight="bold" />
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteImage}
                className="p-1 text-accent"
              >
                <Trash size={20} weight="bold" />
              </button>
            )}
          </div>
        }
        right={
          <button onClick={handleSave} className="text-base tracking-widest text-accent font-medium">
            Save
          </button>
        }
      />

      <div ref={containerRef} className="flex-1 flex items-center justify-center px-4 overflow-hidden relative">
        <div
          className="relative"
          onPointerDown={handlePeekDown}
          onPointerUp={handlePeekUp}
          onPointerCancel={handlePeekUp}
          onPointerLeave={handlePeekUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          <WebGLCanvas ref={canvasHandle} />
          {blurActive && (
            <div
              className="absolute inset-0"
              onPointerDown={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                const nx = (e.clientX - rect.left) / rect.width;
                const ny = (e.clientY - rect.top) / rect.height;
                handleBlurChange({ ...blurParams, center: [nx, ny] });
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                handleBlurChange({ ...blurParams, center: [nx, ny] });
              }}
            >
              <div
                className="absolute w-16 h-16 rounded-full border-2 border-amber-400 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: `${blurParams.center[0] * 100}%`,
                  top: `${blurParams.center[1] * 100}%`,
                }}
              />
            </div>
          )}
        </div>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-muted tracking-widest animate-pulse">Loading...</span>
          </div>
        )}
      </div>

      {cropActive && sourceImg && (
        <CropTool
          sourceImage={sourceImg}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropActive(false)}
        />
      )}

      <div className="shrink-0 bg-surface border-t border-white/5">
        {strengthMode ? (
          <div key="strength" className="animate-panel-fade">
            <div
              className="flex items-center px-5 gap-4 animate-panel-slide-up"
              style={{ height: 96 }}
            >
              <span className="text-[12px] text-muted tracking-wider shrink-0 w-10 text-right">
                {pendingStrength}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={pendingStrength}
                onChange={(e) => handleStrengthChange(Number(e.target.value))}
                className="flex-1 accent-amber-400 h-1"
              />
            </div>
            <div className="flex items-center justify-between px-5 py-6 border-t border-white/5 animate-panel-slide-up" style={{ animationDelay: '0.05s' }}>
              <button onClick={cancelStrength} className="text-accent/80 p-1">
                <X size={22} weight="bold" />
              </button>
              <span className="text-[12px] tracking-widest text-amber-400 font-medium">
                {activeLutShortCode}
              </span>
              <button onClick={confirmStrength} className="text-accent p-1">
                <Check size={22} weight="bold" />
              </button>
            </div>
          </div>
        ) : activePanel === 'filters' ? (
          <div key="filters" className="animate-panel-fade">
            <FolderTabs active={activeTab} onChange={setActiveTab} lutsReady={lutsReady} prefsKey={prefsKey} />
            <FilterStrip
              activeTab={activeTab}
              activeLutId={activeLutId}
              onSelect={handleSelectLUT}
              onClear={handleClearLUT}
              onDoubleTapSelected={enterStrengthMode}
              sourceImage={sourceImg}
              lutsReady={lutsReady}
              prefsKey={prefsKey}
            />
            <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
              <button className="text-base tracking-widest text-amber-400 border-b border-amber-400 pb-0.5">
                Filters
              </button>
              <button
                onClick={() => setActivePanel('effects')}
                className="text-base tracking-widest text-muted/60 hover:text-muted transition-colors"
              >
                FXs
              </button>
              <button
                onClick={() => setActivePanel('adjust')}
                className="text-base tracking-widest text-muted/60 hover:text-muted transition-colors"
              >
                Adjust
              </button>
            </div>
          </div>
        ) : activePanel === 'effects' ? (
          <div key="effects" className="animate-panel-fade">
            <EffectsPanel
              activeEffects={effectParams}
              onChange={(params) => {
                handleEffectsChange(params);
                commitEffects(params);
              }}
              onEditingChange={setEffectsEditing}
            />
            {!effectsEditing && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
                <button
                  onClick={() => setActivePanel('filters')}
                  className="text-base tracking-widest text-muted/60 hover:text-muted transition-colors"
                >
                  Filters
                </button>
                <button className="text-base tracking-widest text-amber-400 border-b border-amber-400 pb-0.5">
                  FXs
                </button>
                <button
                  onClick={() => setActivePanel('adjust')}
                  className="text-base tracking-widest text-muted/60 hover:text-muted transition-colors"
                >
                  Adjust
                </button>
              </div>
            )}
          </div>
        ) : (
          <div key="adjust" className="animate-panel-fade">
            <AdjustPanel
              adjustParams={adjustParams}
              blurParams={blurParams}
              onChange={handleAdjustChange}
              onBlurChange={handleBlurChange}
              onCommit={commitAdjust}
              onCropOpen={() => setCropActive(true)}
              onBlurActiveChange={setBlurActive}
              onEditingChange={setAdjustEditing}
            />
            {!adjustEditing && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
                <button
                  onClick={() => setActivePanel('filters')}
                  className="text-base tracking-widest text-muted/60 hover:text-muted transition-colors"
                >
                  Filters
                </button>
                <button
                  onClick={() => setActivePanel('effects')}
                  className="text-base tracking-widest text-muted/60 hover:text-muted transition-colors"
                >
                  FXs
                </button>
                <button className="text-base tracking-widest text-amber-400 border-b border-amber-400 pb-0.5">
                  Adjust
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <SaveModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleConfirmSave}
      />
    </ScreenShell>
  );
}
