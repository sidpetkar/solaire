import { useMemo } from 'react';
import { getCategories } from '../engine/lutManager';

interface Props {
  active: string;
  onChange: (tab: string) => void;
  lutsReady?: boolean;
  prefsKey?: number;
}

const BRAND_LOGO: Record<string, string> = {
  'Agfa': '/agfa.png',
  'CineStill': '/cinestill.png',
  'Fuji': '/fujifilm.png',
  'Fuji X-Trans': '/fujixtransi.png',
  'Illford': '/illford.png',
  'Kodak': '/kodak.png',
  'Lomography': '/lomography.png',
  'Polaroid': '/poloroid.png',
  'Rollei': '/rollei.png',
  'Svema': '/svema.png',
};

export default function FolderTabs({ active, onChange, lutsReady, prefsKey }: Props) {
  const categories = useMemo(() => (lutsReady ? getCategories() : []), [lutsReady, prefsKey]);

  if (categories.length <= 1) return null;

  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto items-center" style={{ touchAction: 'pan-x' }}>
      {categories.map((cat) => {
        const key = cat === 'all' ? 'all presets' : cat;
        const isActive = active === key;
        const logo = cat !== 'all' ? BRAND_LOGO[cat] : null;

        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`shrink-0 px-3 py-1.5 rounded-sm transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-accent/10 border border-accent/30'
                : 'hover:bg-white/5'
            }`}
          >
            {logo ? (
              <img
                src={logo}
                alt={cat}
                className="h-5 object-contain"
              />
            ) : (
              <span
                className={`text-[12px] tracking-widest font-medium ${
                  isActive ? 'text-accent' : 'text-muted hover:text-accent'
                }`}
              >
                All
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
