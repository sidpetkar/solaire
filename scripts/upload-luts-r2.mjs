/**
 * Upload LUT assets to Cloudflare R2 bucket.
 *
 * Uploads:
 *   - .cube files (original text LUTs, for backward compat)
 *   - .bin files  (33^3 binary LUTs from build-lut-binaries.mjs)
 *   - thumb-bundle.bin (all LUTs at 17^3 for instant thumbnails)
 *   - manifest.json
 *
 * Run build-lut-binaries.mjs FIRST to generate the binary files.
 *
 * Usage:  node scripts/upload-luts-r2.mjs
 *
 * Requires: wrangler logged in (`npx wrangler login`)
 * Bucket name is set below — change if different.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = 'kaptura';
const LUTS_DIR = path.resolve(__dirname, '..', 'public', 'luts');

function walk(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const allFiles = walk(LUTS_DIR);
const cubeFiles = allFiles.filter((f) => f.endsWith('.cube') && !path.basename(f).startsWith('._'));
const binFiles = allFiles.filter((f) => f.endsWith('.bin'));
const manifestPath = path.join(LUTS_DIR, 'manifest.json');

console.log(`Found ${cubeFiles.length} .cube files`);
console.log(`Found ${binFiles.length} .bin files`);
console.log();

if (binFiles.length === 0) {
  console.log('No .bin files found! Run build-lut-binaries.mjs first.\n');
  console.log('  node scripts/build-lut-binaries.mjs');
  console.log('  node scripts/upload-luts-r2.mjs\n');
  process.exit(1);
}

function getContentType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.bin')) return 'application/octet-stream';
  return 'text/plain';
}

const filesToUpload = [
  ...binFiles,
  manifestPath,
  ...cubeFiles,
];

let uploaded = 0;
let failed = 0;

for (const filePath of filesToUpload) {
  const rel = path.relative(path.resolve(LUTS_DIR, '..'), filePath).replace(/\\/g, '/');
  const objectKey = rel;
  const ct = getContentType(filePath);

  try {
    execSync(
      `npx wrangler r2 object put "${BUCKET}/${objectKey}" --remote -f "${filePath}" --ct "${ct}"`,
      { stdio: 'pipe' },
    );
    uploaded++;
    process.stdout.write(`\r  Uploaded ${uploaded}/${filesToUpload.length}`);
  } catch (err) {
    failed++;
    console.error(`\n  FAILED: ${objectKey} — ${err.message}`);
  }
}

console.log(`\n\nDone! ${uploaded} uploaded, ${failed} failed.`);
console.log(`\nBinary LUTs + thumb-bundle uploaded alongside .cube files.`);
console.log(`Set VITE_LUT_BASE_URL to your R2 public URL in .env for production.`);
