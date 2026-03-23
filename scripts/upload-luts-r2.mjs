/**
 * Upload all .cube files from public/luts/ to Cloudflare R2 bucket.
 * Also uploads the manifest.json.
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
const cubeFiles = allFiles.filter((f) => f.endsWith('.cube'));

console.log(`Found ${cubeFiles.length} .cube files to upload\n`);

// Generate manifest.json with R2-relative paths
const manifestPaths = cubeFiles.map((f) => {
  const rel = path.relative(path.resolve(LUTS_DIR, '..'), f).replace(/\\/g, '/');
  return '/' + rel.split('/').map((seg) => encodeURIComponent(seg)).join('/');
});
const manifestPath = path.join(LUTS_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestPaths), 'utf-8');
console.log(`Generated manifest.json with ${manifestPaths.length} entries\n`);

// Upload each file
const filesToUpload = [...cubeFiles, manifestPath];
let uploaded = 0;
let failed = 0;

for (const filePath of filesToUpload) {
  const rel = path.relative(path.resolve(LUTS_DIR, '..'), filePath).replace(/\\/g, '/');
  const objectKey = rel;
  const ct = filePath.endsWith('.json') ? 'application/json' : 'text/plain';

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
console.log(`\nFiles are at: https://<your-r2-public-url>/luts/manifest.json`);
