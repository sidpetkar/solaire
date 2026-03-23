import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GearSix, Plus, Camera } from '@phosphor-icons/react';
import ScreenShell from '../components/ScreenShell';
import ScreenHeader from '../components/ScreenHeader';
import MasonryGrid from '../components/MasonryGrid';
import { useImageStore } from '../hooks/useImageStore';
import { initLUTs } from '../engine/lutManager';

const SCROLL_HIDE_THRESHOLD = 10;

export default function HomeScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { images, importImages } = useImageStore();
  const [barsHidden, setBarsHidden] = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { initLUTs(); }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (files.length === 1) {
        const url = URL.createObjectURL(files[0]);
        navigate('/edit', { state: { imageUrl: url } });
      } else {
        const blobs = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (blobs.length > 0) await importImages(blobs);
      }

      e.target.value = '';
    },
    [navigate, importImages],
  );

  const handleDoubleTap = useCallback(
    (id: string) => navigate('/edit', { state: { imageId: id } }),
    [navigate],
  );

  const enableScrollHide = images.length >= SCROLL_HIDE_THRESHOLD;

  const handleScroll = useCallback(() => {
    if (!enableScrollHide) return;
    setBarsHidden(true);
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setBarsHidden(false), 50);
  }, [enableScrollHide]);

  return (
    <ScreenShell>
      <div className="h-full flex flex-col relative">
        <MasonryGrid images={images} onDoubleTap={handleDoubleTap} onScroll={handleScroll} />

        <div
          className={`absolute top-0 inset-x-0 z-10 fade-down pointer-events-none transition-transform ease-out ${
            barsHidden ? '-translate-y-full duration-500' : 'translate-y-0 duration-300'
          }`}
          style={{ height: 140 }}
        >
          <div className="pointer-events-auto">
            <ScreenHeader
              left={<h1 className="text-lg font-medium tracking-wider normal-case">Welcome Sid,</h1>}
              right={
                <button onClick={() => navigate('/settings')} className="text-accent p-1">
                  <GearSix size={22} weight="fill" />
                </button>
              }
            />
          </div>
        </div>

        <div
          className={`absolute bottom-0 inset-x-0 z-10 fade-up pointer-events-none transition-transform ease-out ${
            barsHidden ? 'translate-y-full duration-500' : 'translate-y-0 duration-300'
          }`}
          style={{ height: 260 }}
        >
          <div className="pointer-events-auto flex items-center justify-center gap-16 pt-32 pb-10">
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                <Plus size={22} weight="bold" className="text-surface" />
              </div>
              <span className="text-base text-accent font-medium uppercase" style={{ letterSpacing: '-0.02em' }}>Add Photo</span>
            </button>

            <button onClick={() => navigate('/camera')} className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                <Camera size={22} weight="bold" className="text-surface" />
              </div>
              <span className="text-base text-accent font-medium uppercase" style={{ letterSpacing: '-0.02em' }}>Take Photo</span>
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} />
      </div>
    </ScreenShell>
  );
}
