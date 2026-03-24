import { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { Check } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

interface GridImage {
  id: string;
  thumbnailUrl: string;
}

interface Props {
  images: GridImage[];
  onDoubleTap?: (id: string) => void;
  onEmptyDoubleTap?: () => void;
  onScroll?: () => void;
  folderTabs?: ReactNode;
  selectedIds?: Set<string>;
  onLongPress?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  selectMode?: boolean;
  deletingIds?: Set<string>;
}

const LONG_PRESS_MS = 500;

export default function MasonryGrid({
  images,
  onDoubleTap,
  onEmptyDoubleTap,
  onScroll,
  folderTabs,
  selectedIds,
  onLongPress,
  onToggleSelect,
  selectMode: selectModeProp,
  deletingIds,
}: Props) {
  const lastTap = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const lastEmptyTap = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const selectMode = selectModeProp ?? (selectedIds != null && selectedIds.size > 0);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (id: string) => {
      longPressFired.current = false;
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        onLongPress?.(id);
      }, LONG_PRESS_MS);
    },
    [clearLongPress, onLongPress],
  );

  const handlePointerUp = useCallback(
    (id: string) => {
      clearLongPress();
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }

      if (selectMode) {
        onToggleSelect?.(id);
        return;
      }

      const now = Date.now();
      if (lastTap.current.id === id && now - lastTap.current.time < 300) {
        onDoubleTap?.(id);
        lastTap.current = { id: '', time: 0 };
      } else {
        lastTap.current = { id, time: now };
      }
    },
    [clearLongPress, selectMode, onToggleSelect, onDoubleTap],
  );

  const handleEmptyTap = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      const now = Date.now();
      if (now - lastEmptyTap.current < 300) {
        onEmptyDoubleTap?.();
        lastEmptyTap.current = 0;
      } else {
        lastEmptyTap.current = now;
      }
    },
    [onEmptyDoubleTap],
  );

  const [colCount, setColCount] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768 ? 8 : 2,
  );

  useEffect(() => {
    const update = () => setColCount(window.innerWidth >= 768 ? 8 : 2);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const columns = useMemo(() => {
    const cols: GridImage[][] = Array.from({ length: colCount }, () => []);
    for (let i = 0; i < images.length; i++) {
      cols[i % colCount].push(images[i]);
    }
    return cols;
  }, [images, colCount]);

  const renderTile = useCallback(
    (img: GridImage) => {
      const isSelected = selectedIds?.has(img.id) ?? false;
      const isDeleting = deletingIds?.has(img.id) ?? false;

      return (
        <div
          key={img.id}
          className="overflow-hidden relative transition-all duration-300 ease-out"
          style={{
            backgroundColor: isSelected && !isDeleting ? '#FBBF24' : 'transparent',
            opacity: isDeleting ? 0 : 1,
            transform: isDeleting ? 'scale(0.85)' : 'scale(1)',
            maxHeight: isDeleting ? 0 : 1000,
          }}
          onPointerDown={() => handlePointerDown(img.id)}
          onPointerUp={() => handlePointerUp(img.id)}
          onPointerCancel={clearLongPress}
          onPointerLeave={clearLongPress}
        >
          <img
            src={img.thumbnailUrl}
            alt=""
            className="w-full h-auto block transition-transform duration-200"
            style={{ transform: isSelected ? 'scale(0.975)' : 'scale(1)' }}
            loading="lazy"
            draggable={false}
          />

          {selectMode && (
            <div
              className="absolute flex items-center justify-center transition-all duration-200"
              style={{
                top: 8,
                right: 8,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: isSelected ? '#FBBF24' : 'rgba(0,0,0,0.3)',
                border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.5)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              {isSelected && <Check size={13} weight="bold" color="#000" />}
            </div>
          )}
        </div>
      );
    },
    [selectedIds, deletingIds, selectMode, handlePointerDown, handlePointerUp, clearLongPress],
  );

  if (images.length === 0) {
    return (
      <div className="flex-1 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6rem)' }}>
        {folderTabs}
        <div className="flex-1 flex items-center justify-center opacity-30" onClick={handleEmptyTap}>
          <p className="text-xs tracking-widest text-muted text-center px-10 pointer-events-none">
            Your edited photos will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden pb-24"
      style={{ touchAction: 'pan-y', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6rem)' }}
      onScroll={onScroll}
      onClick={handleEmptyTap}
    >
      {folderTabs && (
        <div
          className="transition-all duration-300 ease-out origin-center overflow-hidden"
          style={{
            opacity: selectMode ? 0 : 1,
            transform: selectMode ? 'scale(0.92)' : 'scale(1)',
            maxHeight: selectMode ? 0 : 200,
            marginBottom: selectMode ? 0 : undefined,
          }}
        >
          {folderTabs}
        </div>
      )}
      <p className="text-[12px] tracking-wider text-white/50 normal-case pb-2 px-4">
        Double-tap an image to edit!
      </p>
      <div className="flex gap-1 items-start px-1.5">
        {columns.map((col, ci) => (
          <div key={ci} className="flex-1 flex flex-col gap-1">
            {col.map(renderTile)}
          </div>
        ))}
      </div>
    </div>
  );
}
