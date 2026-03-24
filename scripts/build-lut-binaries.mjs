/**
 * Build-time conversion of .cube text LUTs to compact binary format.
 *
 * Produces:
 *   public/luts/bin/<encoded-path>.bin   — 33^3 binary LUT (421 KB each)
 *   public/luts/thumb-bundle.bin         — all LUTs at 8^3, concatenated
 *   public/luts/manifest.json            — updated with binPath + thumbOffset
 *
 * Binary format per .bin file:
 *   [4 bytes] uint32 LE — grid size (e.g. 33)
 *   [size^3 * 3 * 4 bytes] float32 LE — RGB triplets
 *
 * thumb-bundle.bin layout:
 *   Concatenated 8^3 LUTs in manifest order. Each entry is exactly
 *   8^3 * 3 * 4 = 6,144 bytes. Offset = index * 6,144.
 *
 * Usage:  node scripts/build-lut-binaries.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const LUTS_DIR = path.join(PUBLIC_DIR, 'luts');
const BIN_DIR = path.join(LUTS_DIR, 'bin');
const TARGET_SIZE = 33;
const THUMB_SIZE = 8;
const THUMB_ENTRY_BYTES = THUMB_SIZE * THUMB_SIZE * THUMB_SIZE * 3 * 4;

// ── .cube parser ───────────────────────────────────────────────────

function parseCubeFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);
  let size = 0;
  const values = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('TITLE') ||
        t.startsWith('DOMAIN_MIN') || t.startsWith('DOMAIN_MAX')) continue;
    if (t.startsWith('LUT_3D_SIZE')) {
      size = parseInt(t.split(/\s+/)[1], 10);
      continue;
    }
    const parts = t.split(/\s+/);
    if (parts.length >= 3) {
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) values.push(r, g, b);
    }
  }

  if (size === 0) throw new Error(`No LUT_3D_SIZE in ${filePath}`);
  const expected = size * size * size * 3;
  if (values.length !== expected)
    throw new Error(`${filePath}: expected ${expected} values, got ${values.length}`);

  return { size, data: new Float32Array(values) };
}

// ── Trilinear downsample ───────────────────────────────────────────

function sampleLUT(data, srcSize, r, g, b) {
  const maxIdx = srcSize - 1;
  const ri = r * maxIdx, gi = g * maxIdx, bi = b * maxIdx;
  const r0 = Math.min(Math.floor(ri), maxIdx), r1 = Math.min(r0 + 1, maxIdx);
  const g0 = Math.min(Math.floor(gi), maxIdx), g1 = Math.min(g0 + 1, maxIdx);
  const b0 = Math.min(Math.floor(bi), maxIdx), b1 = Math.min(b0 + 1, maxIdx);
  const rf = ri - r0, gf = gi - g0, bf = bi - b0;

  const idx = (ri_, gi_, bi_) => (bi_ * srcSize * srcSize + gi_ * srcSize + ri_) * 3;

  const result = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c000 = data[idx(r0, g0, b0) + c];
    const c100 = data[idx(r1, g0, b0) + c];
    const c010 = data[idx(r0, g1, b0) + c];
    const c110 = data[idx(r1, g1, b0) + c];
    const c001 = data[idx(r0, g0, b1) + c];
    const c101 = data[idx(r1, g0, b1) + c];
    const c011 = data[idx(r0, g1, b1) + c];
    const c111 = data[idx(r1, g1, b1) + c];

    const c00 = c000 * (1 - rf) + c100 * rf;
    const c10 = c010 * (1 - rf) + c110 * rf;
    const c01 = c001 * (1 - rf) + c101 * rf;
    const c11 = c011 * (1 - rf) + c111 * rf;

    const c0 = c00 * (1 - gf) + c10 * gf;
    const c1 = c01 * (1 - gf) + c11 * gf;

    result[c] = c0 * (1 - bf) + c1 * bf;
  }
  return result;
}

function downsample(srcData, srcSize, dstSize) {
  const count = dstSize * dstSize * dstSize;
  const out = new Float32Array(count * 3);
  const maxDst = dstSize - 1;

  for (let bi = 0; bi < dstSize; bi++) {
    for (let gi = 0; gi < dstSize; gi++) {
      for (let ri = 0; ri < dstSize; ri++) {
        const [r, g, b] = sampleLUT(srcData, srcSize, ri / maxDst, gi / maxDst, bi / maxDst);
        const i = (bi * dstSize * dstSize + gi * dstSize + ri) * 3;
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
      }
    }
  }
  return out;
}

// ── Write binary LUT ───────────────────────────────────────────────

function writeBin(outputPath, size, data) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(size, 0);
  const body = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([header, body]));
}

// ── Walk directory ─────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

// ── Main ───────────────────────────────────────────────────────────

const allFiles = walk(LUTS_DIR).filter(f => f.endsWith('.cube') && !path.basename(f).startsWith('._'));
console.log(`Found ${allFiles.length} .cube files\n`);

const manifestEntries = [];
const thumbChunks = [];
let processed = 0;
let skipped = 0;

for (const cubeFile of allFiles) {
  const relToCube = path.relative(PUBLIC_DIR, cubeFile).replace(/\\/g, '/');
  const encodedPath = '/' + relToCube.split('/').map(s => encodeURIComponent(s)).join('/');

  const binRelPath = relToCube.replace(/\.cube$/, '.bin');
  const binFullPath = path.join(BIN_DIR, path.relative('luts', binRelPath));
  const binServePath = '/luts/bin/' + path.relative('luts', binRelPath).replace(/\\/g, '/');
  const encodedBinPath = binServePath.split('/').map(s => encodeURIComponent(s)).join('/');

  try {
    const lut = parseCubeFile(cubeFile);

    const data33 = lut.size > TARGET_SIZE ? downsample(lut.data, lut.size, TARGET_SIZE) : lut.data;
    const size33 = lut.size > TARGET_SIZE ? TARGET_SIZE : lut.size;
    writeBin(binFullPath, size33, data33);

    const data17 = lut.size > THUMB_SIZE
      ? downsample(lut.data, lut.size, THUMB_SIZE)
      : (lut.size === THUMB_SIZE ? lut.data : downsample(data33, size33, THUMB_SIZE));
    thumbChunks.push(Buffer.from(data17.buffer, data17.byteOffset, data17.byteLength));

    manifestEntries.push({
      path: encodedPath,
      binPath: encodedBinPath,
      thumbIndex: thumbChunks.length - 1,
    });

    processed++;
    if (processed % 20 === 0) process.stdout.write(`\r  Processed ${processed}/${allFiles.length}`);
  } catch (err) {
    skipped++;
    console.error(`\n  SKIP: ${relToCube} — ${err.message}`);
    manifestEntries.push({ path: encodedPath, binPath: null, thumbIndex: -1 });
  }
}

process.stdout.write(`\r  Processed ${processed}/${allFiles.length}\n`);

// Write thumb bundle
const thumbBundle = Buffer.concat(thumbChunks);
const thumbBundlePath = path.join(LUTS_DIR, 'thumb-bundle.bin');
fs.writeFileSync(thumbBundlePath, thumbBundle);
console.log(`\nThumb bundle: ${(thumbBundle.byteLength / 1024 / 1024).toFixed(2)} MB (${thumbChunks.length} LUTs × ${(THUMB_ENTRY_BYTES / 1024).toFixed(1)} KB)`);

// Write manifest
const manifestPath = path.join(LUTS_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestEntries, null, 0), 'utf-8');
console.log(`Manifest: ${manifestEntries.length} entries`);

// Summary
const totalBinSize = walk(BIN_DIR).reduce((s, f) => s + fs.statSync(f).size, 0);
console.log(`\nBinary LUTs: ${(totalBinSize / 1024 / 1024).toFixed(2)} MB total`);
console.log(`Done! ${processed} converted, ${skipped} skipped.`);
