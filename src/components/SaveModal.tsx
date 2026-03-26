import { useCallback, useEffect, useState, useRef } from 'react';
import { DownloadSimple, Crown, X } from '@phosphor-icons/react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (withWatermark: boolean) => void;
  onUpgrade: () => void;
  isProUser: boolean;
}

export default function SaveModal({ open, onClose, onSave, onUpgrade, isProUser }: Props) {
  const [visible, setVisible] = useState(false);
  const [sheetIn, setSheetIn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (open) {
      setVisible(true);
      timerRef.current = setTimeout(() => setSheetIn(true), 20);
    } else {
      setSheetIn(false);
      timerRef.current = setTimeout(() => setVisible(false), 350);
    }
    return () => clearTimeout(timerRef.current);
  }, [open]);

  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleRemoveWatermark = useCallback(() => {
    if (isProUser) {
      onSave(false);
    } else {
      onClose();
      onUpgrade();
    }
  }, [isProUser, onSave, onClose, onUpgrade]);

  if (!visible) return null;

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div
        className="md:hidden fixed inset-0 z-50 flex items-end justify-center"
        style={{
          backgroundColor: sheetIn ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
          transition: 'background-color 0.35s ease',
        }}
        onClick={handleBackdrop}
      >
        <div
          className="w-full max-w-md bg-surface rounded-t-2xl px-5 pt-6 pb-8 will-change-transform"
          style={{
            transform: sheetIn ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <h3 className="text-sm font-medium tracking-wider text-accent mb-5 text-center uppercase">
            Save Image
          </h3>
          <button
            onClick={handleRemoveWatermark}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-amber-400 text-surface font-semibold text-sm tracking-wide mb-3"
          >
            <Crown size={18} weight="fill" />
            Remove watermark
            {!isProUser && (
              <span className="text-[10px] tracking-wider text-surface/60 ml-0.5 uppercase font-bold">
                — Upgrade
              </span>
            )}
          </button>
          <button
            onClick={() => onSave(true)}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-surface-lighter text-accent/70 font-medium text-sm tracking-wide"
          >
            <DownloadSimple size={20} weight="bold" />
            Download with watermark
          </button>
        </div>
      </div>

      {/* Desktop: centered popup */}
      <div
        className="hidden md:flex fixed inset-0 z-50 items-center justify-center"
        style={{
          backgroundColor: sheetIn ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
          transition: 'background-color 0.3s ease',
        }}
        onClick={handleBackdrop}
      >
        <div
          className="w-[380px] bg-surface rounded-2xl px-6 pt-5 pb-6 shadow-2xl"
          style={{
            transform: sheetIn ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
            opacity: sheetIn ? 1 : 0,
            transition: 'transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.25s ease',
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-medium tracking-wider text-accent uppercase">
              Save Image
            </h3>
            <button onClick={onClose} className="text-accent/60 hover:text-accent p-1">
              <X size={18} weight="bold" />
            </button>
          </div>
          <button
            onClick={handleRemoveWatermark}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-amber-400 text-surface font-semibold text-sm tracking-wide mb-3"
          >
            <Crown size={18} weight="fill" />
            Remove watermark
            {!isProUser && (
              <span className="text-[10px] tracking-wider text-surface/60 ml-0.5 uppercase font-bold">
                — Upgrade
              </span>
            )}
          </button>
          <button
            onClick={() => onSave(true)}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-surface-lighter text-accent/70 font-medium text-sm tracking-wide"
          >
            <DownloadSimple size={20} weight="bold" />
            Download with watermark
          </button>
        </div>
      </div>
    </>
  );
}
