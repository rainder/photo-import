# Photo Importr — Design Spec

## Overview

A macOS desktop app for browsing photos on a connected SD card, previewing them, selecting which to keep, and importing into Apple Photos. Built with Tauri (Rust backend + React/TypeScript frontend).

## Goals

- Fast, visual workflow for importing camera JPEGs into Photos.app
- Auto-detect SD card insertion
- Quick Look-style preview with keyboard navigation
- Option to delete imported photos from SD card after import

## Non-Goals

- RAW format support (JPEGs only)
- Photo editing, rating, or metadata tagging
- Album organization before import
- Syncing or cloud features

## Tech Stack

- **Framework:** Tauri v2
- **Frontend:** React + TypeScript, bundled with Vite
- **Backend:** Rust (thin layer for filesystem ops and system integration)
- **Photos import:** AppleScript via `osascript`
- **Thumbnail strategy:** EXIF embedded thumbnails when available, fallback to resized JPEG
- **Grid virtualization:** `react-window` or equivalent for large photo sets

## App Layout

The window has four regions:

### 1. Top Bar
- SD card status indicator (green dot when connected, volume name, photo count)
- Auto-detect toggle (on by default, persisted in config)

### 2. Toolbar
- Select All / Deselect All buttons
- Selection count display (e.g., "12 selected")
- Sort dropdown (by date, by name)
- Grid size control

### 3. Photo Grid
- Virtualized thumbnail grid (only visible thumbnails rendered)
- Each thumbnail shows:
  - Checkbox overlay (top-left)
  - Filename label (bottom-right)
- Selected photos: indigo border + filled checkmark
- Unselected photos: slightly dimmed
- Click to focus a photo, click checkbox or use keyboard to select
- Double-click or Space on focused photo opens preview mode

### 4. Bottom Action Bar
- "Delete from SD card after import" checkbox (unchecked by default)
- "Import N Photos" button (disabled when nothing selected)

## Preview Mode

Activated by pressing Space or double-clicking a thumbnail in the grid. Displays as a full-window overlay with dark background.

### Layout
- **Top bar:** Filename, dimensions, file size, date, position counter ("3 of 128"), Esc close button
- **Center:** Full-size photo with left/right navigation arrows
- **Bottom bar:** Select/deselect checkbox, keyboard shortcut hints

### Keyboard Shortcuts
| Key | Grid View | Preview Mode |
|-----|-----------|-------------|
| Space | Open preview of focused photo | Toggle select/deselect |
| Double-click | Open preview | — |
| ← → | — | Navigate to prev/next photo |
| Esc | — | Return to grid view |

### Behavior
- Arrow key navigation wraps (last photo → first photo)
- Returning to grid scrolls to the photo that was being previewed
- Selection state syncs between grid and preview views

## Rust Backend — Tauri Commands

### `list_photos(volume_path: String) -> Vec<PhotoMeta>`
Scans the `DCIM` folder recursively for JPEG files. Returns metadata for each:
```rust
struct PhotoMeta {
    name: String,
    path: String,
    size: u64,        // bytes
    date: String,     // ISO 8601 from filesystem modified time
    width: u32,       // from EXIF if available, 0 otherwise
    height: u32,
}
```

### `get_thumbnail(path: String) -> String`
Returns a base64-encoded JPEG thumbnail. Reads EXIF embedded thumbnail first (fast path). Falls back to loading and resizing the full JPEG to 400px wide. Thumbnails are cached in a `HashMap<String, String>` for the session.

### `get_full_image(path: String) -> String`
Returns a Tauri asset protocol URL (`asset://localhost/...`) for the full-size JPEG. The frontend loads this directly in an `<img>` tag, avoiding base64 encoding overhead for large files.

### `watch_volumes() -> EventStream`
Watches `/Volumes` for mount/unmount events. When a new volume appears, checks for a `DCIM` directory. Emits Tauri events:
- `sd-card-mounted { volume_name, path }` 
- `sd-card-unmounted { volume_name }`

### `import_to_photos(paths: Vec<String>) -> ImportResult`
Executes AppleScript to import files into Photos.app:
```applescript
tell application "Photos"
    import POSIX file "/path/to/photo.jpg"
end tell
```
Returns success/failure per file.

### `delete_from_card(paths: Vec<String>) -> DeleteResult`
Deletes specified files from the SD card. Returns success/failure per file.

## Config

Minimal JSON config stored in Tauri's app data directory:
```json
{
    "autoDetect": true
}
```

Only stores the auto-detect preference. All other state (selections, grid size) is session-only.

## Import Flow

1. User clicks "Import N Photos"
2. Confirmation dialog: "Import 12 photos into Photos?"
3. Progress bar with per-file status: "Importing IMG_0042.jpg — 7 of 12"
4. If "delete from card" was checked: second confirmation: "Delete 12 imported photos from SD card? This cannot be undone."
5. Deletion proceeds if confirmed
6. Success toast with count; imported photos get a dimmed "Imported" badge in the grid

## Error Handling

| Scenario | Behavior |
|----------|----------|
| SD card ejected mid-import | Stop import, show which files succeeded vs failed, skip deletion |
| Photos.app not running | `osascript` launches it automatically |
| Duplicate photo in Photos | Photos.app handles deduplication natively |
| Permission denied on SD card | Prompt user to grant Full Disk Access in System Settings |
| No DCIM folder on volume | Volume ignored by auto-detect; manual browse still works |

## Project Structure

```
photo-import/
├── src/                    # React frontend
│   ├── App.tsx
│   ├── components/
│   │   ├── Grid.tsx        # Virtualized photo grid
│   │   ├── Thumbnail.tsx   # Individual thumbnail with selection
│   │   ├── Preview.tsx     # Full-size preview overlay
│   │   ├── TopBar.tsx      # SD card status + auto-detect toggle
│   │   ├── Toolbar.tsx     # Select all, sort, grid size
│   │   ├── ActionBar.tsx   # Delete checkbox + import button
│   │   └── ImportDialog.tsx # Progress + confirmation dialogs
│   ├── hooks/
│   │   ├── usePhotos.ts    # Photo list + thumbnail loading
│   │   ├── useSelection.ts # Selection state management
│   │   └── useSDCard.ts    # SD card mount/unmount events
│   ├── lib/
│   │   └── commands.ts     # Typed wrappers around Tauri invoke()
│   └── main.tsx
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands.rs     # Tauri command handlers
│   │   ├── photos.rs       # JPEG scanning + thumbnail extraction
│   │   ├── volumes.rs      # SD card detection + watching
│   │   └── import.rs       # AppleScript import + deletion
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
