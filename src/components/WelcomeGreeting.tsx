import { useState, useEffect, useRef, useMemo } from 'react';
import type { GreetingFrame } from '../hooks/useGreeting';

const FRAME_H = 46;
const CYCLE_MS = 10_000;

interface Props {
  frames: GreetingFrame[];
  logoSrc?: string;
}

type Slot = { type: 'text'; frame: GreetingFrame } | { type: 'logo'; src: string };

export default function WelcomeGreeting({ frames, logoSrc }: Props) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const slots = useMemo<Slot[]>(() => {
    const s: Slot[] = [];
    if (isMobile && logoSrc && frames.length > 0) {
      s.push({ type: 'logo', src: logoSrc });
      for (const f of frames) {
        s.push({ type: 'text', frame: f });
        s.push({ type: 'logo', src: logoSrc });
      }
    } else if (isMobile && logoSrc) {
      s.push({ type: 'logo', src: logoSrc });
    } else {
      for (const f of frames) {
        s.push({ type: 'text', frame: f });
      }
    }
    return s;
  }, [frames, logoSrc, isMobile]);

  const [index, setIndex] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (slots.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => {
        prevRef.current = i;
        return (i + 1) % slots.length;
      });
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [slots.length]);

  useEffect(() => {
    setIndex(0);
    prevRef.current = 0;
  }, [slots.length]);

  if (slots.length === 0) return null;

  return (
    <div
      className="normal-case grid overflow-hidden"
      style={{ height: FRAME_H, minWidth: 160 }}
    >
      {slots.map((slot, i) => {
        const active = i === index;
        const leaving = i === prevRef.current && i !== index;

        let cls = 'transition-all duration-500 ease-out ';
        if (active) {
          cls += 'opacity-100 translate-y-0';
        } else if (leaving) {
          cls += 'opacity-0 -translate-y-full';
        } else {
          cls += 'opacity-0 translate-y-full pointer-events-none';
        }

        return (
          <div
            key={i}
            style={{ height: FRAME_H, gridArea: '1 / 1' }}
            className={cls}
          >
            {slot.type === 'logo' ? (
              <div className="flex items-center" style={{ height: FRAME_H }}>
                <img
                  src={slot.src}
                  alt="Solaire"
                  style={{ height: 40 }}
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col justify-center" style={{ height: FRAME_H }}>
                <div className="text-lg font-medium tracking-wider leading-tight whitespace-nowrap">
                  {slot.frame[0]}
                </div>
                <div className="text-[11px] text-muted tracking-wide leading-tight mt-0.5 whitespace-nowrap">
                  {slot.frame[1]}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
