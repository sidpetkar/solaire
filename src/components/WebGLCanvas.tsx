import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { WebGLRenderer } from '../engine/webgl';

export interface WebGLCanvasHandle {
  renderer: WebGLRenderer | null;
  canvas: HTMLCanvasElement | null;
}

interface Props {
  className?: string;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

const WebGLCanvas = forwardRef<WebGLCanvasHandle, Props>(({ className, onContextLost, onContextRestored }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGLRenderer(canvas);
    rendererRef.current = renderer;

    const handleLost = (e: Event) => {
      e.preventDefault();
      console.warn('[WebGL] Context lost');
      setContextLost(true);
      onContextLost?.();
    };

    const handleRestored = () => {
      console.warn('[WebGL] Context restored — re-creating renderer');
      rendererRef.current?.destroy();
      try {
        rendererRef.current = new WebGLRenderer(canvas);
      } catch {
        console.error('[WebGL] Failed to re-create renderer after context restore');
      }
      setContextLost(false);
      onContextRestored?.();
    };

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
      renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    get renderer() {
      return rendererRef.current;
    },
    get canvas() {
      return canvasRef.current;
    },
  }));

  return (
    <>
      <canvas ref={canvasRef} className={className} />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
          Restoring graphics…
        </div>
      )}
    </>
  );
});

WebGLCanvas.displayName = 'WebGLCanvas';
export default WebGLCanvas;
