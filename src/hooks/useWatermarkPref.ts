import { useState, useEffect, useCallback } from 'react';
import { settingsStore } from '../store/db';

const STORAGE_KEY = 'watermark_disabled';
const ADMIN_EMAIL = 'siddhantpetkar@gmail.com';

let memoryCache: boolean | null = null;

export function useWatermarkPref() {
  const [watermarkEnabled, setWatermarkEnabled] = useState(
    () => memoryCache === null ? true : !memoryCache,
  );
  const [loaded, setLoaded] = useState(memoryCache !== null);

  useEffect(() => {
    if (memoryCache !== null) return;
    settingsStore.getItem<boolean>(STORAGE_KEY).then((stored) => {
      const disabled = stored ?? false;
      memoryCache = disabled;
      setWatermarkEnabled(!disabled);
      setLoaded(true);
    });
  }, []);

  const toggleWatermark = useCallback(async () => {
    setWatermarkEnabled((prev) => {
      const next = !prev;
      memoryCache = !next;
      settingsStore.setItem(STORAGE_KEY, !next);
      return next;
    });
  }, []);

  return { watermarkEnabled, toggleWatermark, loaded };
}

export function getWatermarkEnabled(): boolean {
  if (memoryCache === null) return true;
  return !memoryCache;
}

export function canRemoveWatermark(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

export function shouldWatermark(
  email: string | null | undefined,
  isGuest: boolean,
): boolean {
  if (isGuest) return true;
  if (!canRemoveWatermark(email)) return true;
  return getWatermarkEnabled();
}
