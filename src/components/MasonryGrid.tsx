import { useRef, useCallback, useMemo } from 'react';

interface GridImage {
  id: string;
  thumbnailUrl: string;
}

interface Props {
  images: GridImage[];
  onDoubleTap?: (id: string) => void;
  onScroll?: () => void;
}

export default function MasonryGrid({ images, onDoubleTap, onScroll }: Props) {
  const lastTap = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  const handleTap = useCallback(
    (id: string) => {
      const now = Date.now();
      if (lastTap.current.id === id && now - lastTap.current.time < 300) {
        onDoubleTap?.(id);
        lastTap.current = { id: '', time: 0 };
      } else {
        lastTap.current = { id, time: now };
      }
    },
    [onDoubleTap],
  );

  const columns = useMemo(() => {
    const left: GridImage[] = [];
    const right: GridImage[] = [];
    for (let i = 0; i < images.length; i++) {
      if (i % 2 === 0) left.push(images[i]);
      else right.push(images[i]);
    }
    return [left, right];
  }, [images]);

  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center opacity-30">
        <p className="text-xs tracking-widest text-muted text-center px-10">
          Your edited photos will appear here
        </p>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="flex-1 flex items-center justify-center px-12">
        <div
          onClick={() => handleTap(images[0].id)}
          className="w-full overflow-hidden"
        >
          <img src={images[0].thumbnailUrl} alt="" className="w-full h-auto" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 pt-24 pb-64"
      style={{ touchAction: 'pan-y' }}
      onScroll={onScroll}
    >
      <div className="flex gap-1 items-start">
        {columns.map((col, ci) => (
          <div key={ci} className="flex-1 flex flex-col gap-1">
            {col.map((img) => (
              <div
                key={img.id}
                onClick={() => handleTap(img.id)}
                className="overflow-hidden"
              >
                <img src={img.thumbnailUrl} alt="" className="w-full h-auto block" loading="lazy" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
