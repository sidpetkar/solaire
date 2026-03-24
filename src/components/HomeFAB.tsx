import { useState, useCallback } from 'react';
import { Plus, Camera, Images, FolderOpen } from '@phosphor-icons/react';

interface Props {
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  onImportFolder: () => void;
}

const pills = [
  { key: 'camera', label: 'Take Photo', icon: Camera, action: 'onTakePhoto' },
  { key: 'gallery', label: 'Choose from Gallery', icon: Images, action: 'onChooseGallery' },
  { key: 'folder', label: 'Import Folder', icon: FolderOpen, action: 'onImportFolder' },
] as const;

export default function HomeFAB({ onTakePhoto, onChooseGallery, onImportFolder }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const actions: Record<string, () => void> = {
    onTakePhoto,
    onChooseGallery,
    onImportFolder,
  };

  const handlePill = useCallback(
    (action: string) => {
      close();
      actions[action]?.();
    },
    [close, actions],
  );

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          background: 'radial-gradient(ellipse 150% 130% at 95% 95%, rgba(33,36,33,0.98) 0%, rgba(33,36,33,0.95) 25%, rgba(33,36,33,0.85) 45%, rgba(33,36,33,0.6) 65%, rgba(33,36,33,0.25) 85%, transparent 100%)',
        }}
        onClick={close}
      />

      {/* Pill actions */}
      <div
        className={`fixed z-50 flex flex-col items-end gap-3 transition-all duration-300 ${
          open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        style={{ bottom: 100, right: 20 }}
      >
        {pills.map((pill, i) => (
          <button
            key={pill.key}
            onClick={() => handlePill(pill.action)}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-surface-lighter/80 backdrop-blur-sm text-accent transition-all duration-300"
            style={{
              transitionDelay: open ? `${(pills.length - 1 - i) * 60}ms` : '0ms',
              transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
              opacity: open ? 1 : 0,
            }}
          >
            <pill.icon size={18} weight="bold" />
            <span className="text-sm font-medium tracking-wide">{pill.label}</span>
          </button>
        ))}
      </div>

      {/* Subtle bottom fade behind FAB */}
      <div
        className="fixed z-40 inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: 120,
          background: 'linear-gradient(to top, rgba(33,36,33,0.8) 0%, rgba(33,36,33,0.4) 40%, transparent 100%)',
        }}
      />

      {/* FAB button */}
      <button
        onClick={toggle}
        className={`fixed z-50 flex items-center justify-center w-14 h-14 rounded-full transition-colors duration-300 ${
          !open ? 'animate-fab-nudge' : ''
        }`}
        style={{
          bottom: 28,
          right: 20,
          backgroundColor: open ? 'var(--color-surface-lighter)' : '#EAB308',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.25)',
        }}
      >
        <Plus
          size={24}
          weight="bold"
          className="transition-transform duration-300"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
          color={open ? 'var(--color-accent)' : 'var(--color-surface)'}
        />
      </button>
    </>
  );
}
