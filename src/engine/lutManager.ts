import localforage from 'localforage';
import { parseCube, parseBinary } from './cubeParser';
import { WebGLRenderer } from './webgl';
import { getDisabledCategories } from '../hooks/useCategoryPrefs';
import { lutTierFor } from './lutTier';
import type { ParsedLUT, LUTMeta } from '../types';

const LUT_BASE = import.meta.env.VITE_LUT_BASE_URL || '';

const LUT_REGISTRY: LUTMeta[] = [];
const parsedCache = new Map<string, ParsedLUT>();
const categoryIndex = new Map<string, LUTMeta[]>();

let initialized = false;
let initPromise: Promise<void> | null = null;

let thumbRenderer: WebGLRenderer | null = null;
let thumbCanvas: HTMLCanvasElement | null = null;

const THUMB_LUT_SIZE = 8;
const THUMB_ENTRY_BYTES = THUMB_LUT_SIZE ** 3 * 3 * 4;
let thumbBundleBuffer: ArrayBuffer | null = null;
let thumbBundlePromise: Promise<void> | null = null;

// ── Public getters ──────────────────────────────────────────────────

export function getLUTById(id: string): LUTMeta | undefined {
  return LUT_REGISTRY.find((m) => m.id === id);
}

export function getAllLUTs(): LUTMeta[] {
  const disabled = getDisabledCategories();
  if (disabled.size === 0) return LUT_REGISTRY;
  return LUT_REGISTRY.filter((m) => !disabled.has(m.category));
}

export function getLUTsByCategory(category: string): LUTMeta[] {
  if (category === 'all') return getAllLUTs();
  const disabled = getDisabledCategories();
  if (disabled.has(category)) return [];
  return categoryIndex.get(category) ?? [];
}

export function getCategories(): string[] {
  const disabled = getDisabledCategories();
  const enabled = Array.from(categoryIndex.keys())
    .filter((c) => !disabled.has(c))
    .sort();
  return ['all', ...enabled];
}

export function getAllCategoryNames(): string[] {
  return Array.from(categoryIndex.keys()).sort();
}

export function getCategoryLutCount(category: string): number {
  return (categoryIndex.get(category) ?? []).length;
}

// ── Thumb bundle ────────────────────────────────────────────────────

export function getThumbLUT(meta: LUTMeta): ParsedLUT | null {
  if (meta.thumbIndex == null || meta.thumbIndex < 0 || !thumbBundleBuffer) return null;
  const offset = meta.thumbIndex * THUMB_ENTRY_BYTES;
  if (offset + THUMB_ENTRY_BYTES > thumbBundleBuffer.byteLength) return null;
  const data = new Float32Array(thumbBundleBuffer, offset, THUMB_LUT_SIZE ** 3 * 3);
  return { size: THUMB_LUT_SIZE, data };
}

export function isThumbBundleReady(): boolean {
  return thumbBundleBuffer !== null;
}

async function loadThumbBundle() {
  try {
    const url = LUT_BASE
      ? `${LUT_BASE}/luts/thumb-bundle.bin`
      : '/luts/thumb-bundle.bin';
    const resp = await fetch(url);
    if (!resp.ok) return;
    thumbBundleBuffer = await resp.arrayBuffer();
  } catch (e) {
    console.warn('[LUT] thumb-bundle load failed:', e);
  }
}

// ── Full LUT loading ────────────────────────────────────────────────

export async function loadLUT(meta: LUTMeta): Promise<ParsedLUT> {
  const cached = parsedCache.get(meta.id);
  if (cached) return cached;

  try {
    const dbCached = await idbGet(meta.id);
    if (dbCached) {
      parsedCache.set(meta.id, dbCached);
      return dbCached;
    }
  } catch { /* IndexedDB unavailable */ }

  if (meta.binPath) {
    try {
      const binUrl = LUT_BASE ? `${LUT_BASE}${meta.binPath}` : meta.binPath;
      const resp = await fetch(binUrl);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        const parsed = parseBinary(buf);
        parsedCache.set(meta.id, parsed);
        idbPut(meta.id, parsed).catch(() => {});
        return parsed;
      }
    } catch (e) { console.warn('[LUT] .bin load failed, falling back to .cube:', meta.id, e); }
  }

  const url = LUT_BASE ? `${LUT_BASE}${meta.path}` : meta.path;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load LUT: ${url}`);
  const text = await response.text();
  const parsed = parseCube(text);
  parsedCache.set(meta.id, parsed);
  idbPut(meta.id, parsed).catch(() => {});
  return parsed;
}

// ── IndexedDB persistence via localforage ───────────────────────────

const lutStore = localforage.createInstance({ name: 'solaire', storeName: 'lut_cache' });

async function idbGet(id: string): Promise<ParsedLUT | null> {
  try {
    const entry = await lutStore.getItem<{ size: number; data: ArrayBuffer }>(id);
    if (!entry) return null;
    return { size: entry.size, data: new Float32Array(entry.data) };
  } catch {
    return null;
  }
}

async function idbPut(id: string, lut: ParsedLUT): Promise<void> {
  try {
    await lutStore.setItem(id, {
      size: lut.size,
      data: lut.data.buffer.slice(lut.data.byteOffset, lut.data.byteOffset + lut.data.byteLength),
    });
  } catch { /* quota or permission error */ }
}

// ── Init ────────────────────────────────────────────────────────────

export function initLUTs(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = doInit();
  return initPromise;
}

interface ManifestEntry {
  path: string;
  binPath?: string | null;
  thumbIndex?: number;
  brand?: string;
  displayName?: string;
  tier?: 'free' | 'pro';
}

function sortFreeFirst(list: LUTMeta[]) {
  list.sort((a, b) => {
    const af = a.tier === 'free' ? 0 : 1;
    const bf = b.tier === 'free' ? 0 : 1;
    return af - bf;
  });
}

async function doInit() {
  try {
    const manifestUrl = LUT_BASE ? `${LUT_BASE}/luts/manifest.json` : '/luts/manifest.json';
    const resp = await fetch(manifestUrl);
    if (!resp.ok) { initialized = true; return; }
    const raw = await resp.json();

    const entries: ManifestEntry[] = typeof raw[0] === 'string'
      ? (raw as string[]).map((p: string) => ({ path: p }))
      : raw as ManifestEntry[];

    const hasThumbBundle = entries.some(e => e.thumbIndex != null && e.thumbIndex >= 0);
    if (hasThumbBundle && !thumbBundlePromise) {
      thumbBundlePromise = loadThumbBundle();
    }

    const seenIds = new Set<string>();

    for (const entry of entries) {
      const decodedPath = decodeURIComponent(entry.path);
      const segments = decodedPath.replace(/^\/luts\//, '').split('/');
      const filename = segments.pop()!.replace('.cube', '');

      let id = filename.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (seenIds.has(id)) {
        const brand = entry.brand ?? 'unknown';
        const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]/g, '_');
        id = `${brandSlug}_${id}`;
      }
      let suffix = 2;
      const baseId = id;
      while (seenIds.has(id)) {
        id = `${baseId}_${suffix++}`;
      }
      seenIds.add(id);

      const name = entry.displayName ?? filename;
      const category = entry.brand ?? 'Uncategorized';
      const tier = entry.tier ?? lutTierFor(category, name);

      const meta: LUTMeta = {
        id,
        name,
        shortCode: name,
        category,
        path: entry.path,
        binPath: entry.binPath ?? null,
        thumbIndex: entry.thumbIndex ?? -1,
        tier,
      };

      LUT_REGISTRY.push(meta);

      let bucket = categoryIndex.get(category);
      if (!bucket) {
        bucket = [];
        categoryIndex.set(category, bucket);
      }
      bucket.push(meta);
    }

    sortFreeFirst(LUT_REGISTRY);
    for (const bucket of categoryIndex.values()) {
      sortFreeFirst(bucket);
    }

    if (thumbBundlePromise) await thumbBundlePromise;
  } catch (e) {
    console.warn('[LUT] manifest load failed:', e);
  }
  initialized = true;
}

// ── Thumbnail generation ────────────────────────────────────────────

function getThumbRenderer(): WebGLRenderer | null {
  if (thumbRenderer) return thumbRenderer;
  try {
    thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 76;
    thumbCanvas.height = 76;
    thumbRenderer = new WebGLRenderer(thumbCanvas);
    return thumbRenderer;
  } catch {
    return null;
  }
}

function centerCrop(
  source: HTMLImageElement | HTMLCanvasElement,
  size: number,
): HTMLCanvasElement {
  const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return c;
}

export async function generateThumbnail(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  lut: ParsedLUT,
  size = 76,
): Promise<string> {
  const cropped = centerCrop(sourceImage, size);

  const renderer = getThumbRenderer();
  if (!renderer || !thumbCanvas) {
    return cropped.toDataURL('image/jpeg', 0.6);
  }

  if (thumbCanvas.width !== size || thumbCanvas.height !== size) {
    thumbCanvas.width = size;
    thumbCanvas.height = size;
  }

  renderer.uploadImage(cropped);
  renderer.uploadLUT(lut);
  renderer.render();
  renderer.flush();
  return thumbCanvas.toDataURL('image/jpeg', 0.6);
}
