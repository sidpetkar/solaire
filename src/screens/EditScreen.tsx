import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowUUpLeft, ArrowUUpRight, Trash, Check, X,
  DotsThreeOutlineVertical, FloppyDisk, DownloadSimple, FolderOpen,
} from '@phosphor-icons/react';
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
import { useFolderStore, type FolderMeta } from '../hooks/useFolderStore';
import { metaStore } from '../store/db';
import { useCategoryPrefs } from '../hooks/useCategoryPrefs';
import { shouldWatermark } from '../hooks/useWatermarkPref';
import { useAuth } from '../context/AuthContext';
import { applyWatermark } from '../engine/watermark';
import { initLUTs, getLUTById, loadLUT } from '../engine/lutManager';
import { DEFAULT_BLUR_PARAMS, type AdjustParams, type BlurParams } from '../engine/adjustments';
import type { LUTMeta, ParsedLUT } from '../types';
import type { EffectParams } from '../engine/effects';
import { useEditSession, type SerializedHistoryEntry, type EditSession } from '../hooks/useEditSession';
import { uploadEditState } from '../services/cloudSync';

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
  const { user, isGuest } = useAuth();
  const doWatermark = shouldWatermark(user?.email, isGuest);

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
  const [showMenu, setShowMenu] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const { folders } = useFolderStore();
  const [strengthMode, setStrengthMode] = useState(false);
  const [filterStrength, setFilterStrength] = useState(100);
  const [pendingStrength, setPendingStrength] = useState(100);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const activeEntry = history[historyIndex];
  const activeLutShortCode = activeEntry?.meta?.shortCode ?? '';

  const state = location.state as { imageUrl?: string; imageId?: string } | null;
  const existingId = state?.imageId ?? undefined;
  const { save: saveSession, load: loadSession } = useEditSession(existingId);
  const sessionRestored = useRef(false);

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

      const maxTex = handle.renderer.getMaxTextureSize();
      const previewMax = Math.min(2048, maxTex);
      const gpuScale = Math.min(1, previewMax / img.naturalWidth, previewMax / img.naturalHeight);
      const canvasW = Math.round(img.naturalWidth * gpuScale);
      const canvasH = Math.round(img.naturalHeight * gpuScale);

      const displayScale = Math.min(1, maxW / canvasW, maxH / canvasH);

      handle.canvas.width = canvasW;
      handle.canvas.height = canvasH;
      handle.canvas.style.width = `${Math.round(canvasW * displayScale)}px`;
      handle.canvas.style.height = `${Math.round(canvasH * displayScale)}px`;

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
      img.onerror = (e) => {
        console.error('Failed to load image for editor:', e);
      };
      img.src = url;
    }

    load();
    return () => { cancelled = true; };
  }, [state, getFullImage, renderToCanvas]);

  // Restore saved edit session when image + LUTs are ready
  useEffect(() => {
    if (!sourceImg || !lutsReady || !existingId || sessionRestored.current) return;
    sessionRestored.current = true;

    (async () => {
      const session = await loadSession();
      if (!session || session.history.length === 0) return;

      const handle = canvasHandle.current;
      if (!handle?.renderer) return;

      const restoredHistory: HistoryEntry[] = await Promise.all(
        session.history.map(async (entry: SerializedHistoryEntry) => {
          let meta: LUTMeta | null = null;
          let parsed: ParsedLUT | null = null;
          if (entry.lutId) {
            meta = getLUTById(entry.lutId) ?? null;
            if (meta) {
              try { parsed = await loadLUT(meta); } catch { /* LUT may have been removed */ }
            }
          }
          return {
            lutId: entry.lutId,
            meta,
            parsed,
            effectParams: entry.effectParams,
            adjustParams: entry.adjustParams,
            blurParams: entry.blurParams,
          };
        }),
      );

      const idx = Math.min(session.historyIndex, restoredHistory.length - 1);
      const current = restoredHistory[idx];

      setHistory(restoredHistory);
      setHistoryIndex(idx);
      setActiveLutId(current.lutId);
      setEffectParams(current.effectParams);
      setAdjustParams(current.adjustParams);
      setBlurParams(current.blurParams);
      setFilterStrength(session.filterStrength);
      setActivePanel(session.activePanel as EditorPanel);

      handle.renderer.setEffects(current.effectParams);
      handle.renderer.setAdjustments(current.adjustParams);
      handle.renderer.setBlur(current.blurParams.amount > 0 ? current.blurParams : null);
      handle.renderer.setIntensity(session.filterStrength / 100);

      if (current.parsed) {
        handle.renderer.uploadLUT(current.parsed);
      } else {
        handle.renderer.clearLUT();
      }
      handle.renderer.uploadImage(sourceImg);
      handle.renderer.render();
    })();
  }, [sourceImg, lutsReady, existingId, loadSession]);

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

  // Auto-save edit session to IndexedDB on every change
  useEffect(() => {
    if (!existingId || !sessionRestored.current) return;
    const serialized: SerializedHistoryEntry[] = history.map((e) => ({
      lutId: e.lutId,
      lutShortCode: e.meta?.shortCode ?? null,
      effectParams: e.effectParams,
      adjustParams: e.adjustParams,
      blurParams: e.blurParams,
    }));
    saveSession({
      history: serialized,
      historyIndex,
      filterStrength,
      activePanel,
    });
  }, [history, historyIndex, filterStrength, activePanel, existingId, saveSession]);

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

  const pushEditStateToCloud = useCallback((imageId: string) => {
    if (!user) return;
    const serialized: SerializedHistoryEntry[] = history.map((e) => ({
      lutId: e.lutId,
      lutShortCode: e.meta?.shortCode ?? null,
      effectParams: e.effectParams,
      adjustParams: e.adjustParams,
      blurParams: e.blurParams,
    }));
    const session: EditSession = {
      imageId,
      history: serialized,
      historyIndex,
      filterStrength,
      activePanel,
      updatedAt: Date.now(),
    };
    uploadEditState(user.uid, imageId, session).catch(() => {});
  }, [user, history, historyIndex, filterStrength, activePanel]);

  const handleSaveToApp = useCallback(async () => {
    setShowMenu(false);
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;
    try {
      const blob = await handle.renderer.exportBlob(
        sourceImg, sourceImg.naturalWidth, sourceImg.naturalHeight,
      );
      const id = await saveImage(blob, activeLutId ?? undefined, existingId);
      pushEditStateToCloud(id);
      navigate('/');
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [activeLutId, saveImage, navigate, sourceImg, existingId, pushEditStateToCloud]);

  const handleConfirmDownload = useCallback(async (withWatermark: boolean) => {
    setShowSaveModal(false);
    const handle = canvasHandle.current;
    if (!handle?.renderer || !sourceImg) return;
    try {
      const blob = await handle.renderer.exportBlob(
        sourceImg, sourceImg.naturalWidth, sourceImg.naturalHeight,
      );
      const id = await saveImage(blob, activeLutId ?? undefined, existingId);
      pushEditStateToCloud(id);
      const filename = `SOLAIRE_${id}.jpg`;

      if (withWatermark && doWatermark) {
        const wmBlob = await applyWatermark(blob);
        downloadBlob(wmBlob, filename);
      } else {
        downloadBlob(blob, filename);
      }
      navigate('/');
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [activeLutId, saveImage, navigate, sourceImg, existingId, doWatermark, pushEditStateToCloud]);

  const handleDownload = useCallback(() => {
    setShowMenu(false);
    if (!doWatermark) {
      handleConfirmDownload(false);
      return;
    }
    setShowSaveModal(true);
  }, [doWatermark, handleConfirmDownload]);

  const handleMoveToFolder = useCallback(async (folder: FolderMeta) => {
    setShowFolderPicker(false);
    setShowMenu(false);
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    try {
      if (sourceImg) handle.renderer.uploadImage(sourceImg);
      const blob = await handle.renderer.toBlob();
      const id = await saveImage(blob, activeLutId ?? undefined, existingId);
      const existing = await metaStore.getItem<{ id: string; timestamp: number; lutId?: string; folderId?: string }>(id);
      if (existing) {
        await metaStore.setItem(id, { ...existing, folderId: folder.id });
      }
      navigate('/');
    } catch (err) {
      console.error('Move failed:', err);
    }
  }, [activeLutId, saveImage, navigate, sourceImg, existingId]);

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

  // ── Long-press peek ───────────────────────────────────────────────
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPeekingRef = useRef(false);

  // ── Zoom / pan / pinch state (ref-based for 60fps) ──────────────
  const imageWrapperRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const [isZoomed, setIsZoomed] = useState(false);
  const lastTapTimeRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });
  const panActiveRef = useRef(false);
  const panLastRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1, cx: 0, cy: 0, startTx: 0, startTy: 0 });

  const zoomAnimRef = useRef(0);

  const applyZoom = useCallback(() => {
    const el = imageWrapperRef.current;
    if (!el) return;
    const { scale, tx, ty } = zoomRef.current;
    el.style.transform = scale <= 1.01
      ? ''
      : `translate(${tx}px, ${ty}px) scale(${scale})`;
    el.style.transformOrigin = '0 0';
  }, []);

  const clampPan = useCallback(() => {
    const el = imageWrapperRef.current;
    if (!el) return;
    const { scale } = zoomRef.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    zoomRef.current.tx = Math.min(0, Math.max(w * (1 - scale), zoomRef.current.tx));
    zoomRef.current.ty = Math.min(0, Math.max(h * (1 - scale), zoomRef.current.ty));
  }, []);

  const animateZoomTo = useCallback((targetScale: number, targetTx: number, targetTy: number, onDone?: () => void) => {
    if (zoomAnimRef.current) cancelAnimationFrame(zoomAnimRef.current);

    const from = { ...zoomRef.current };
    const duration = 280;
    const start = performance.now();

    function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const e = easeOutCubic(t);

      zoomRef.current.scale = from.scale + (targetScale - from.scale) * e;
      zoomRef.current.tx = from.tx + (targetTx - from.tx) * e;
      zoomRef.current.ty = from.ty + (targetTy - from.ty) * e;
      applyZoom();

      if (t < 1) {
        zoomAnimRef.current = requestAnimationFrame(tick);
      } else {
        zoomAnimRef.current = 0;
        onDone?.();
      }
    }

    zoomAnimRef.current = requestAnimationFrame(tick);
  }, [applyZoom]);

  const resetZoom = useCallback(() => {
    animateZoomTo(1, 0, 0, () => setIsZoomed(false));
  }, [animateZoomTo]);

  const handleImagePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (blurActive) return;

    const now = Date.now();
    const dx = e.clientX - lastTapPosRef.current.x;
    const dy = e.clientY - lastTapPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Double-tap detection (< 300ms, < 30px apart)
    if (now - lastTapTimeRef.current < 300 && dist < 30) {
      if (peekTimerRef.current) {
        clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;

      if (zoomRef.current.scale > 1.01) {
        resetZoom();
      } else {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const newScale = 2.5;
        const targetTx = cx * (1 - newScale);
        const targetTy = cy * (1 - newScale);
        setIsZoomed(true);
        animateZoomTo(newScale, targetTx, targetTy);
      }
      return;
    }

    lastTapTimeRef.current = now;
    lastTapPosRef.current = { x: e.clientX, y: e.clientY };

    // If zoomed, start pan instead of peek
    if (zoomRef.current.scale > 1.01) {
      panActiveRef.current = true;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Normal long-press peek
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
    }, 400);
  }, [sourceImg, blurActive, resetZoom, clampPan, applyZoom, animateZoomTo]);

  const handleImagePointerMove = useCallback((e: React.PointerEvent) => {
    if (!panActiveRef.current) return;
    const dx = e.clientX - panLastRef.current.x;
    const dy = e.clientY - panLastRef.current.y;
    panLastRef.current = { x: e.clientX, y: e.clientY };
    zoomRef.current.tx += dx;
    zoomRef.current.ty += dy;
    clampPan();
    applyZoom();
  }, [clampPan, applyZoom]);

  const handleImagePointerUp = useCallback(() => {
    panActiveRef.current = false;

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

  // ── Pinch-to-zoom via touch events ──────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (blurActive) return;
    if (e.touches.length === 2) {
      if (peekTimerRef.current) {
        clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      pinchRef.current = {
        active: true,
        startDist: dist,
        startScale: zoomRef.current.scale,
        cx: ((t0.clientX + t1.clientX) / 2) - rect.left,
        cy: ((t0.clientY + t1.clientY) / 2) - rect.top,
        startTx: zoomRef.current.tx,
        startTy: zoomRef.current.ty,
      };
    }
  }, [blurActive]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pinchRef.current.active || e.touches.length < 2) return;
    e.preventDefault();
    const t0 = e.touches[0], t1 = e.touches[1];
    const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    const ratio = dist / pinchRef.current.startDist;
    const newScale = Math.min(6, Math.max(1, pinchRef.current.startScale * ratio));
    const { cx, cy, startTx, startTy, startScale } = pinchRef.current;

    zoomRef.current.scale = newScale;
    zoomRef.current.tx = cx - (cx - startTx) * (newScale / startScale);
    zoomRef.current.ty = cy - (cy - startTy) * (newScale / startScale);
    clampPan();
    applyZoom();
    setIsZoomed(newScale > 1.01);
  }, [clampPan, applyZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchRef.current.active = false;
      if (zoomRef.current.scale <= 1.01) {
        resetZoom();
      }
    }
  }, [resetZoom]);

  return (
    <ScreenShell>
      <ScreenHeader
        left={
          <button onClick={() => navigate(-1)} className="p-1 text-accent/80">
            <X size={22} weight="bold" />
          </button>
        }
        center={
          history.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className={`p-1 transition-opacity ${canUndo ? 'text-accent' : 'text-accent/30'}`}
              >
                <ArrowUUpLeft size={20} weight="bold" />
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className={`p-1 transition-opacity ${canRedo ? 'text-accent' : 'text-accent/30'}`}
              >
                <ArrowUUpRight size={20} weight="bold" />
              </button>
            </div>
          ) : undefined
        }
        right={
          <>
            {/* Desktop: inline action buttons */}
            <div className="hidden md:flex items-center gap-1">
              <button onClick={handleSaveToApp} className="p-2 text-accent/80 hover:text-accent transition-colors" title="Save">
                <FloppyDisk size={20} weight="bold" />
              </button>
              <button onClick={handleDownload} className="p-2 text-accent/80 hover:text-accent transition-colors" title="Download">
                <DownloadSimple size={20} weight="bold" />
              </button>
              {folders.length > 0 && (
                <button onClick={() => setShowFolderPicker(true)} className="p-2 text-accent/80 hover:text-accent transition-colors" title="Move to Album">
                  <FolderOpen size={20} weight="bold" />
                </button>
              )}
              <button onClick={handleDeleteImage} className="p-2 text-red-400/70 hover:text-red-400 transition-colors" title="Delete">
                <Trash size={20} weight="bold" />
              </button>
            </div>

            {/* Mobile: 3-dot dropdown */}
            <div className="relative md:hidden">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-1 text-accent"
              >
                <DotsThreeOutlineVertical size={22} weight="fill" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-48 bg-surface-lighter rounded-xl shadow-xl border border-white/10 py-1 animate-panel-fade">
                    <button
                      onClick={handleSaveToApp}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-accent hover:bg-white/5 transition-colors"
                    >
                      <FloppyDisk size={18} weight="bold" />
                      Save
                    </button>
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-accent hover:bg-white/5 transition-colors"
                    >
                      <DownloadSimple size={18} weight="bold" />
                      Download
                    </button>
                    {folders.length > 0 && (
                      <button
                        onClick={() => { setShowMenu(false); setShowFolderPicker(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-accent hover:bg-white/5 transition-colors"
                      >
                        <FolderOpen size={18} weight="bold" />
                        Move to Album
                      </button>
                    )}
                    <div className="mx-3 border-t border-white/8" />
                    <button
                      onClick={() => { setShowMenu(false); handleDeleteImage(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors"
                    >
                      <Trash size={18} weight="bold" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      <div ref={containerRef} className="flex-1 flex items-center justify-center px-4 overflow-hidden relative">
        <div
          className="relative overflow-hidden"
          style={{ touchAction: isZoomed ? 'none' : 'auto' }}
          onPointerDown={handleImagePointerDown}
          onPointerMove={handleImagePointerMove}
          onPointerUp={handleImagePointerUp}
          onPointerCancel={handleImagePointerUp}
          onPointerLeave={handleImagePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div ref={imageWrapperRef}>
            <WebGLCanvas ref={canvasHandle} />
          </div>
          {blurActive && !isZoomed && (
            <div
              className="absolute inset-0"
              onPointerDown={(e) => {
                e.stopPropagation();
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
          <div key="strength" className="animate-panel-fade max-w-[600px] mx-auto w-full">
            <div
              className="flex items-center px-4 gap-4 animate-panel-slide-up"
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
            <div className="flex items-center justify-between px-4 py-6 border-t border-white/5 animate-panel-slide-up" style={{ animationDelay: '0.05s' }}>
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
            <div className="border-t border-white/5">
              <div className="flex items-center justify-between md:justify-center md:gap-8 px-4 py-4 max-w-[600px] mx-auto">
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
          </div>
        ) : activePanel === 'effects' ? (
          <div key="effects" className="animate-panel-fade">
            <div className="max-w-[600px] mx-auto w-full">
              <EffectsPanel
                activeEffects={effectParams}
                onChange={(params) => {
                  handleEffectsChange(params);
                  commitEffects(params);
                }}
                onEditingChange={setEffectsEditing}
              />
            </div>
            {!effectsEditing && (
              <div className="border-t border-white/5">
                <div className="flex items-center justify-between md:justify-center md:gap-8 px-4 py-4 max-w-[600px] mx-auto">
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
              <div className="border-t border-white/5">
                <div className="flex items-center justify-between md:justify-center md:gap-8 px-4 py-4 max-w-[600px] mx-auto">
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
              </div>
            )}
          </div>
        )}
      </div>

      <SaveModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleConfirmDownload}
      />

      {showFolderPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center animate-panel-fade"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowFolderPicker(false); }}
        >
          <div className="w-full max-w-md bg-surface rounded-t-2xl px-5 pt-6 pb-8 animate-panel-slide-up">
            <h3 className="text-sm font-medium tracking-wider text-accent mb-5 text-center uppercase">
              Move to Album
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleMoveToFolder(f)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm text-accent hover:bg-white/5 transition-colors"
                >
                  <FolderOpen size={18} weight="bold" className="text-amber-400/70" />
                  {f.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFolderPicker(false)}
              className="w-full mt-4 py-3 rounded-xl bg-surface-lighter text-accent/60 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </ScreenShell>
  );
}
