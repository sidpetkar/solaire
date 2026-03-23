# KAPTURA — Developer Commands Cheat Sheet

## Everyday Development

### Start the app locally
```bash
npm run dev
```
Opens at `http://localhost:5173`. Your local LUTs in `public/luts/` are used automatically.

### Stop the dev server
Press `Ctrl + C` in the terminal where it's running.

---

## Pushing Code Changes

Every time you make changes and want to deploy:

```bash
git add .
git commit -m "short description of what you changed"
git push
```

That's it — Vercel auto-deploys after every push.

### Useful git commands

| Command | What it does |
|---|---|
| `git status` | Shows what files you changed |
| `git diff` | Shows the actual code changes |
| `git log --oneline` | Shows recent commits |
| `git restore <file>` | Undo changes to a file (before committing) |

---

## LUT Management (Cloudflare R2)

### Upload LUTs to cloud storage
Run this whenever you add/remove LUT packs from `public/luts/`:

```bash
node scripts/upload-luts-r2.mjs
```

This scans `public/luts/`, generates a `manifest.json`, and uploads everything to your Cloudflare R2 bucket. Takes ~8 seconds per file.

### First-time setup (already done)
```bash
npx wrangler login
```

---

## Building for Production

### Test a production build locally
```bash
npm run build
npm run preview
```

You normally don't need this — Vercel builds for you on every push.

---

## Installing Dependencies

If you clone the project fresh or add a new package:

```bash
npm install
```

### Add a new package
```bash
npm install package-name
```

### Add a dev-only package
```bash
npm install -D package-name
```

---

## Project Architecture (Quick Reference)

```
kaptura-pwa/
├── public/luts/          ← Your LUT .cube files (local only, NOT in git)
├── scripts/              ← Upload script for R2
├── src/
│   ├── components/       ← Reusable UI pieces
│   ├── engine/           ← WebGL renderer, LUT parser, shaders
│   ├── hooks/            ← React hooks (camera, image store, etc.)
│   ├── screens/          ← Full pages (Home, Edit, Camera, Settings)
│   ├── store/            ← IndexedDB storage config
│   └── types/            ← TypeScript type definitions
├── .env                  ← Local environment variables (NOT in git)
├── .env.example          ← Template for .env
├── vite.config.ts        ← Build config + LUT manifest plugin
└── package.json          ← Dependencies and scripts
```

---

## Environment Variables

| Variable | Where | Value |
|---|---|---|
| `VITE_LUT_BASE_URL` | `.env` (local) | Leave empty — uses `public/luts/` |
| `VITE_LUT_BASE_URL` | Vercel dashboard | Your R2 public URL (`https://pub-xxx.r2.dev`) |

---

## Where Things Are Hosted

| What | Where | Dashboard |
|---|---|---|
| App code | **Vercel** | [vercel.com/dashboard](https://vercel.com/dashboard) |
| LUT files | **Cloudflare R2** | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 |
| Source code | **GitHub** | [github.com/sidpetkar/kaptura](https://github.com/sidpetkar/kaptura) |

---

## Common Scenarios

### "I changed some code and want to deploy"
```bash
git add .
git commit -m "what I changed"
git push
```

### "I added new LUT packs"
1. Drop the folders into `public/luts/`
2. Run `node scripts/upload-luts-r2.mjs`
3. Restart dev server to see them locally: `npm run dev`

### "I want to undo my recent changes"
```bash
git restore .
```
This resets ALL changed files back to the last commit.

### "I cloned this on a new computer"
```bash
npm install
cp .env.example .env
```
Then add your LUT folders to `public/luts/` and run `npm run dev`.

### "The app works locally but not on Vercel"
Check that `VITE_LUT_BASE_URL` is set in Vercel dashboard → Settings → Environment Variables. Redeploy after changing it.
