import { useCallback, useRef } from 'react';
import { editStore } from '../store/db';
import type { AdjustParams, BlurParams } from '../engine/adjustments';
import type { EffectParams } from '../engine/effects';

export interface SerializedHistoryEntry {
  lutId: string | null;
  lutShortCode: string | null;
  effectParams: EffectParams;
  adjustParams: AdjustParams;
  blurParams: BlurParams;
}

export interface EditSession {
  imageId: string;
  history: SerializedHistoryEntry[];
  historyIndex: number;
  filterStrength: number;
  activePanel: string;
  updatedAt: number;
}

const DEBOUNCE_MS = 500;

export function useEditSession(imageId: string | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (session: Omit<EditSession, 'imageId' | 'updatedAt'>) => {
      if (!imageId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const data: EditSession = {
          ...session,
          imageId,
          updatedAt: Date.now(),
        };
        editStore.setItem(imageId, data).catch(() => {});
      }, DEBOUNCE_MS);
    },
    [imageId],
  );

  const load = useCallback(async (): Promise<EditSession | null> => {
    if (!imageId) return null;
    return editStore.getItem<EditSession>(imageId);
  }, [imageId]);

  return { save, load };
}
