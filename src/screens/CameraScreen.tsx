import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowsClockwise } from '@phosphor-icons/react';
import ScreenShell from '../components/ScreenShell';
import ScreenHeader from '../components/ScreenHeader';
import WebGLCanvas, { type WebGLCanvasHandle } from '../components/WebGLCanvas';
import FolderTabs from '../components/FolderTabs';
import FilterStrip from '../components/FilterStrip';
import AspectRatioSelector from '../components/AspectRatioSelector';
import ShutterButton from '../components/ShutterButton';
import PricingModal from '../components/PricingModal';
import { useCamera } from '../hooks/useCamera';
import { useImageStore, downloadBlob } from '../hooks/useImageStore';
import { shouldWatermark } from '../hooks/useWatermarkPref';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { applyWatermark } from '../engine/watermark';
import { initLUTs, getLUTById } from '../engine/lutManager';
import { premiumExportBlocked, canImportMoreImages } from '../engine/lutTier';
import { ASPECT_RATIOS } from '../types';
import type { AspectRatio, LUTMeta, ParsedLUT } from '../types';

export default function CameraScreen() {
  const navigate = useNavigate();
  const canvasHandle = useRef<WebGLCanvasHandle>(null);
  const { videoRef, start, stop, switchCamera } = useCamera();
  const { saveImage, images: libraryImages } = useImageStore();
  const { user, isGuest } = useAuth();
  const { tier, isProUser } = useSubscription();
  const doWatermark = shouldWatermark(user?.email, isGuest, tier);

  const [activeTab, setActiveTab] = useState('all presets');
  const [activeLutId, setActiveLutId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [captured, setCaptured] = useState(false);
  const [lutsReady, setLutsReady] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  const activeLutRef = useRef<ParsedLUT | null>(null);

  useEffect(() => {
    initLUTs().then(() => setLutsReady(true));
  }, []);

  const startVideoFeed = useCallback(async () => {
    const video = videoRef.current;
    const handle = canvasHandle.current;
    if (!video || !handle?.renderer) return;

    await new Promise<void>((resolve) => {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        resolve();
      } else {
        video.addEventListener('loadeddata', () => resolve(), { once: true });
      }
    });

    handle.canvas!.width = video.videoWidth || 1280;
    handle.canvas!.height = video.videoHeight || 720;

    if (activeLutRef.current) {
      handle.renderer.uploadLUT(activeLutRef.current);
    }

    handle.renderer.startVideoLoop(video);
  }, [videoRef]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await start();
        if (cancelled) return;
        await startVideoFeed();
      } catch (err) {
        console.error('Camera init failed:', err);
      }
    }

    init();

    return () => {
      cancelled = true;
      canvasHandle.current?.renderer?.stopVideoLoop();
      stop();
    };
  }, []);

  const handleSelectLUT = useCallback(async (meta: LUTMeta, parsed: ParsedLUT) => {
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    handle.renderer.uploadLUT(parsed);
    activeLutRef.current = parsed;
    setActiveLutId(meta.id);
  }, []);

  const handleClearLUT = useCallback(() => {
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    handle.renderer.clearLUT();
    activeLutRef.current = null;
    setActiveLutId(null);
  }, []);

  const handleCapture = useCallback(() => {
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    handle.renderer.stopVideoLoop();
    setCaptured(true);
  }, []);

  const handleRetake = useCallback(async () => {
    setCaptured(false);
    try {
      await start();
      await startVideoFeed();
    } catch (err) {
      console.error('Retake failed:', err);
    }
  }, [start, startVideoFeed]);

  const handleSave = useCallback(async () => {
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    const lutMeta = activeLutId ? getLUTById(activeLutId) : null;
    if (premiumExportBlocked(lutMeta ?? null, isProUser) || !canImportMoreImages(isProUser, libraryImages.length)) {
      setShowPricing(true);
      return;
    }
    try {
      const blob = await handle.renderer.toBlob();
      const id = await saveImage(blob, activeLutId ?? undefined);
      const filename = `SOLAIRE_${id}.jpg`;

      if (doWatermark) {
        const wmBlob = await applyWatermark(blob);
        downloadBlob(wmBlob, filename);
      } else {
        downloadBlob(blob, filename);
      }
      navigate('/');
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [activeLutId, saveImage, navigate, doWatermark, isProUser, libraryImages.length]);

  const handleSwitchCamera = useCallback(async () => {
    const handle = canvasHandle.current;
    if (!handle?.renderer) return;
    handle.renderer.stopVideoLoop();

    try {
      await switchCamera();
      await startVideoFeed();
    } catch (err) {
      console.error('Switch camera failed:', err);
    }
  }, [switchCamera, startVideoFeed]);

  const ratioValue = ASPECT_RATIOS.find((r) => r.label === aspectRatio)?.value ?? 16 / 9;

  return (
    <ScreenShell>
      <ScreenHeader
        left={
          <button onClick={() => { stop(); navigate('/'); }} className="text-accent">
            <ArrowLeft size={24} weight="bold" />
          </button>
        }
        right={
          <button onClick={handleSwitchCamera} className="text-accent" disabled={captured}>
            <ArrowsClockwise size={24} weight="bold" />
          </button>
        }
      />

      <div className="flex-1 flex items-center justify-center px-4 overflow-hidden">
        <div
          className="relative overflow-hidden rounded-sm"
          style={{ aspectRatio: String(ratioValue), maxWidth: '100%', maxHeight: '100%' }}
        >
          <WebGLCanvas ref={canvasHandle} className="w-full h-full object-cover" />
        </div>
      </div>

      <video ref={videoRef} playsInline muted className="hidden" />

      <div className="shrink-0 bg-surface border-t border-white/5">
        <FolderTabs active={activeTab} onChange={setActiveTab} lutsReady={lutsReady} />
        <FilterStrip
          activeTab={activeTab}
          activeLutId={activeLutId}
          onSelect={handleSelectLUT}
          onClear={handleClearLUT}
          sourceImage={null}
          lutsReady={lutsReady}
          isProUser={isProUser}
        />
        <AspectRatioSelector active={aspectRatio} onChange={setAspectRatio} />

        <div className="flex items-center justify-between px-8 pb-10 pt-3">
          {captured ? (
            <button onClick={handleRetake} className="text-base tracking-widest text-accent/80 w-20">
              Retake
            </button>
          ) : (
            <div className="w-20" />
          )}
          <ShutterButton onCapture={handleCapture} disabled={captured} />
          {captured ? (
            <button onClick={handleSave} className="text-base tracking-widest text-accent font-medium w-20 text-right">
              Save
            </button>
          ) : (
            <div className="w-20" />
          )}
        </div>
      </div>
      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} />
    </ScreenShell>
  );
}
