# Photo Import

A fast, keyboard-driven macOS app to browse, preview, and import photos from your camera's SD card directly into Apple Photos.

I got tired of every photo import app being either slow, clunky, or built for someone who doesn't use a keyboard. So I built the one I actually wanted.

## Features

- **Auto-detect SD cards** — plug in your camera's SD card and Photo Import finds it automatically
- **Keyboard-first** — navigate, select, preview, and import without touching the mouse
- **Quick preview** — full-size preview with left/right navigation
- **Import to Photos.app** — selected photos go straight into Apple Photos
- **Date-grouped grid** — photos organized by date with section headers
- **Review before import** — double-check your selection before committing

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `← → ↑ ↓` | Navigate grid |
| `Space` | Select / deselect |
| `Enter` | Open preview |
| `⌘ Enter` | Review & import |
| `⌘ ⌫` | Delete photo |
| `⌘ +/−` | Zoom grid |
| `⌘ A` | Select all |
| `⌘ R` | Reload |

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Tauri v2 (Rust)
- **Website:** Next.js + Tailwind CSS (deployed on Vercel)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build DMG for distribution
npm run tauri build
```

Requires macOS 12+, Apple Silicon.

## Support

If this app saved you some headaches:

- **Bitcoin:** `bc1ql4sjy9h60ea22rncaqn95zergef3mp62tjxgxf4wfljgz2dgs93sle6ptc`
- **Lightning:** `purpleparrot1@primal.net`
