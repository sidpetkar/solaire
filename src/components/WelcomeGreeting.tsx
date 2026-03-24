import { useState, useEffect } from 'react';
import type { GreetingFrame } from '../hooks/useGreeting';

const FRAME_H = 46;
const CYCLE_MS = 10_000;

interface Props {
  frames: GreetingFrame[];
}

export default function WelcomeGreeting({ frames }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [frames.length]);

  if (frames.length === 0) return null;

  return (
    <div className="normal-case grid animate-greeting-enter" style={{ height: FRAME_H }}>
      {frames.map(([line1, line2], i) => (
        <div
          key={i}
          style={{ height: FRAME_H, gridArea: '1 / 1' }}
          className={`flex flex-col justify-center transition-all duration-700 ease-out ${
            i === index
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-1.5'
          }`}
        >
          <div className="text-lg font-medium tracking-wider leading-tight whitespace-nowrap">{line1}</div>
          <div className="text-[11px] text-muted tracking-wide leading-tight mt-0.5 whitespace-nowrap">{line2}</div>
        </div>
      ))}
    </div>
  );
}
