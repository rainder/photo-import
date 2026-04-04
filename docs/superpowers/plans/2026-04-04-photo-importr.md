# Photo Importr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a macOS desktop app (Tauri + React/TS) for browsing SD card photos, previewing them, and importing into Apple Photos.

**Architecture:** Tauri v2 app with a thin Rust backend handling filesystem operations (scan DCIM, extract thumbnails, watch volumes, call osascript for Photos import) and a React/TypeScript frontend providing a virtualized photo grid with Quick Look-style preview. Communication via Tauri IPC commands and events.

**Tech Stack:** Tauri v2, Rust, React 18, TypeScript, Vite, react-window (virtualized grid), Vitest + React Testing Library (frontend tests), cargo test (backend tests)

**Spec:** `docs/superpowers/specs/2026-04-04-photo-importr-design.md`

---

## File Structure

```
photo-import/
├── src/                        # React frontend
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root component, state orchestration
│   ├── App.css                 # Global styles
│   ├── components/
│   │   ├── TopBar.tsx          # SD card status + auto-detect toggle
│   │   ├── Toolbar.tsx         # Select all, sort, grid size controls
│   │   ├── Grid.tsx            # Virtualized photo grid using react-window
│   │   ├── Thumbnail.tsx       # Individual photo tile with checkbox
│   │   ├── Preview.tsx         # Full-size preview overlay
│   │   ├── ActionBar.tsx       # Delete checkbox + import button
│   │   └── ImportDialog.tsx    # Progress + confirmation modals
│   ├── hooks/
│   │   ├── useSelection.ts    # Selection set management
│   │   ├── usePhotos.ts       # Photo list loading + thumbnail URLs
│   │   └── useSDCard.ts       # Volume mount/unmount events
│   └── lib/
│       └── commands.ts         # Typed wrappers for Tauri invoke()
├── src/__tests__/              # Frontend tests
│   ├── useSelection.test.ts
│   ├── usePhotos.test.ts
│   ├── Grid.test.tsx
│   ├── Preview.test.tsx
│   └── ImportDialog.test.tsx
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── lib.rs             # Tauri plugin setup + command registration
│   │   ├── main.rs            # Tauri app entry point
│   │   ├── photos.rs          # DCIM scanning + thumbnail extraction
│   │   ├── volumes.rs         # /Volumes watcher + DCIM detection
│   │   └── import.rs          # osascript Photos import + file deletion
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

### Task 1: Scaffold Tauri + React + Vite Project

**Files:**
- Create: all scaffolded files via `create-tauri-app`
- Modify: `package.json` (add dependencies)
- Modify: `src-tauri/tauri.conf.json` (window config)
- Modify: `src-tauri/Cargo.toml` (add crate dependencies)

- [ ] **Step 1: Initialize the Tauri project**

```bash
cd /Users/andy/Developer/photo-import
npm create tauri-app@latest . -- --template react-ts --manager npm
```

When prompted, select:
- Package manager: npm
- UI template: React
- UI flavor: TypeScript

- [ ] **Step 2: Install frontend dependencies**

```bash
cd /Users/andy/Developer/photo-import
npm install react-window
npm install -D @types/react-window vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Add Rust crate dependencies**

Edit `src-tauri/Cargo.toml` — add to `[dependencies]`:

```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
notify = "7"
image = { version = "0.25", features = ["jpeg"] }
img-parts = "0.3"
base64 = "0.22"
tauri = { version = "2", features = ["asset-protocol-scope"] }
```

- [ ] **Step 4: Configure Tauri window**

Edit `src-tauri/tauri.conf.json` — set the window properties:

```json
{
  "app": {
    "windows": [
      {
        "title": "Photo Importr",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "assetProtocol": {
        "enable": true,
        "scope": {
          "allow": ["/Volumes/**"]
        }
      }
    }
  }
}
```

- [ ] **Step 5: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 6: Verify it builds and runs**

```bash
cd /Users/andy/Developer/photo-import
npm run tauri dev
```

Expected: A Tauri window opens showing the default React template page.

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules/\ntarget/\ndist/\n.superpowers/" > .gitignore
git add .
git commit -m "chore: scaffold Tauri + React + Vite project"
```

---

### Task 2: Rust — PhotoMeta Type + list_photos Command

**Files:**
- Create: `src-tauri/src/photos.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create photos module with types and scan logic**

Create `src-tauri/src/photos.rs`:

```rust
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct PhotoMeta {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub date: String,
}

pub fn scan_dcim(volume_path: &str) -> Vec<PhotoMeta> {
    let dcim_path = Path::new(volume_path).join("DCIM");
    if !dcim_path.exists() {
        return vec![];
    }
    let mut photos = Vec::new();
    scan_dir_recursive(&dcim_path, &mut photos);
    photos.sort_by(|a, b| a.name.cmp(&b.name));
    photos
}

fn scan_dir_recursive(dir: &Path, photos: &mut Vec<PhotoMeta>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir_recursive(&path, photos);
        } else if is_jpeg(&path) {
            if let Ok(meta) = fs::metadata(&path) {
                let date = meta
                    .modified()
                    .ok()
                    .and_then(|t| {
                        let datetime: chrono::DateTime<chrono::Utc> = t.into();
                        Some(datetime.to_rfc3339())
                    })
                    .unwrap_or_default();

                photos.push(PhotoMeta {
                    name: path.file_name().unwrap_or_default().to_string_lossy().into(),
                    path: path.to_string_lossy().into(),
                    size: meta.len(),
                    date,
                });
            }
        }
    }
}

fn is_jpeg(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(ext.to_lowercase().as_str(), "jpg" | "jpeg"),
        None => false,
    }
}
```

- [ ] **Step 2: Add chrono dependency to Cargo.toml**

Add to `src-tauri/Cargo.toml` `[dependencies]`:

```toml
chrono = "0.4"
```

- [ ] **Step 3: Register the Tauri command in lib.rs**

Edit `src-tauri/src/lib.rs`:

```rust
mod photos;
mod import;
mod volumes;

use photos::{scan_dcim, PhotoMeta};

#[tauri::command]
fn list_photos(volume_path: String) -> Vec<PhotoMeta> {
    scan_dcim(&volume_path)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_photos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Create stub files for other modules**

Create `src-tauri/src/import.rs`:
```rust
// Photos.app import + SD card deletion
```

Create `src-tauri/src/volumes.rs`:
```rust
// Volume mount/unmount watching
```

- [ ] **Step 5: Write a unit test for scan_dcim**

Add to the bottom of `src-tauri/src/photos.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_scan_dcim_finds_jpegs() {
        let tmp = tempdir().unwrap();
        let dcim = tmp.path().join("DCIM").join("100CANON");
        fs::create_dir_all(&dcim).unwrap();

        File::create(dcim.join("IMG_0001.JPG")).unwrap().write_all(b"fake jpeg").unwrap();
        File::create(dcim.join("IMG_0002.jpg")).unwrap().write_all(b"fake jpeg").unwrap();
        File::create(dcim.join("readme.txt")).unwrap().write_all(b"not a photo").unwrap();

        let photos = scan_dcim(tmp.path().to_str().unwrap());
        assert_eq!(photos.len(), 2);
        assert_eq!(photos[0].name, "IMG_0001.JPG");
        assert_eq!(photos[1].name, "IMG_0002.jpg");
    }

    #[test]
    fn test_scan_dcim_no_dcim_folder() {
        let tmp = tempdir().unwrap();
        let photos = scan_dcim(tmp.path().to_str().unwrap());
        assert_eq!(photos.len(), 0);
    }
}
```

- [ ] **Step 6: Add tempfile dev dependency**

Add to `src-tauri/Cargo.toml`:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test
```

Expected: 2 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/photos.rs src-tauri/src/lib.rs src-tauri/src/import.rs src-tauri/src/volumes.rs src-tauri/Cargo.toml
git commit -m "feat: add list_photos command with DCIM scanning"
```

---

### Task 3: Rust — Thumbnail Extraction

**Files:**
- Modify: `src-tauri/src/photos.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing test for thumbnail extraction**

Add to the test module in `src-tauri/src/photos.rs`:

```rust
    #[test]
    fn test_get_thumbnail_returns_base64() {
        // Create a minimal valid JPEG (1x1 pixel)
        let tmp = tempdir().unwrap();
        let img_path = tmp.path().join("test.jpg");

        let img = image::RgbImage::new(100, 100);
        img.save(&img_path).unwrap();

        let result = get_thumbnail(img_path.to_str().unwrap());
        assert!(result.is_ok());
        let b64 = result.unwrap();
        assert!(!b64.is_empty());
        // Verify it's valid base64 that decodes to JPEG
        let decoded = base64::engine::general_purpose::STANDARD.decode(&b64).unwrap();
        assert!(decoded.len() > 0);
    }
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test test_get_thumbnail
```

Expected: FAIL — `get_thumbnail` not found.

- [ ] **Step 3: Implement get_thumbnail**

Add to `src-tauri/src/photos.rs` (above the test module):

```rust
use base64::Engine;
use image::imageops::FilterType;
use std::collections::HashMap;
use std::sync::Mutex;

static THUMBNAIL_CACHE: std::sync::LazyLock<Mutex<HashMap<String, String>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

const THUMBNAIL_WIDTH: u32 = 400;

pub fn get_thumbnail(path: &str) -> Result<String, String> {
    // Check cache
    if let Ok(cache) = THUMBNAIL_CACHE.lock() {
        if let Some(cached) = cache.get(path) {
            return Ok(cached.clone());
        }
    }

    // Load and resize
    let img = image::open(path).map_err(|e| format!("Failed to open image: {}", e))?;
    let thumbnail = img.resize(THUMBNAIL_WIDTH, THUMBNAIL_WIDTH, FilterType::Triangle);

    // Encode to JPEG bytes
    let mut buf = std::io::Cursor::new(Vec::new());
    thumbnail
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(buf.into_inner());

    // Cache it
    if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
        cache.insert(path.to_string(), b64.clone());
    }

    Ok(b64)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test test_get_thumbnail
```

Expected: PASS

- [ ] **Step 5: Register Tauri command**

Add to `src-tauri/src/lib.rs`:

```rust
use photos::{scan_dcim, PhotoMeta};

#[tauri::command]
fn get_thumbnail(path: String) -> Result<String, String> {
    photos::get_thumbnail(&path)
}
```

And update the handler registration:

```rust
.invoke_handler(tauri::generate_handler![list_photos, get_thumbnail])
```

- [ ] **Step 6: Run all tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/photos.rs src-tauri/src/lib.rs
git commit -m "feat: add thumbnail extraction with caching"
```

---

### Task 4: Rust — Volume Watching (SD Card Detection)

**Files:**
- Modify: `src-tauri/src/volumes.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing test for DCIM detection**

Replace `src-tauri/src/volumes.rs` contents:

```rust
use std::fs;
use std::path::Path;

/// Check if a volume path contains a DCIM folder (camera card indicator)
pub fn has_dcim(volume_path: &str) -> bool {
    Path::new(volume_path).join("DCIM").is_dir()
}

/// List currently mounted volumes that contain a DCIM folder
pub fn list_camera_volumes() -> Vec<CameraVolume> {
    let volumes_dir = Path::new("/Volumes");
    let mut result = Vec::new();

    if let Ok(entries) = fs::read_dir(volumes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && has_dcim(path.to_str().unwrap_or("")) {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into();
                result.push(CameraVolume {
                    name,
                    path: path.to_string_lossy().into(),
                });
            }
        }
    }

    result
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CameraVolume {
    pub name: String,
    pub path: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_has_dcim_true() {
        let tmp = tempdir().unwrap();
        fs::create_dir(tmp.path().join("DCIM")).unwrap();
        assert!(has_dcim(tmp.path().to_str().unwrap()));
    }

    #[test]
    fn test_has_dcim_false() {
        let tmp = tempdir().unwrap();
        assert!(!has_dcim(tmp.path().to_str().unwrap()));
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test -- volumes
```

Expected: 2 tests pass.

- [ ] **Step 3: Add volume watcher with Tauri events**

Add to `src-tauri/src/volumes.rs` (above the test module):

```rust
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

pub fn start_volume_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match RecommendedWatcher::new(tx, notify::Config::default()) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create volume watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(Path::new("/Volumes"), RecursiveMode::NonRecursive) {
            eprintln!("Failed to watch /Volumes: {}", e);
            return;
        }

        // Emit initial state
        for vol in list_camera_volumes() {
            let _ = app.emit("sd-card-mounted", &vol);
        }

        for event in rx {
            match event {
                Ok(Event { kind: EventKind::Create(_), paths, .. }) => {
                    for path in &paths {
                        // Small delay for mount to complete
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        if let Some(path_str) = path.to_str() {
                            if has_dcim(path_str) {
                                let vol = CameraVolume {
                                    name: path.file_name().unwrap_or_default().to_string_lossy().into(),
                                    path: path_str.to_string(),
                                };
                                let _ = app.emit("sd-card-mounted", &vol);
                            }
                        }
                    }
                }
                Ok(Event { kind: EventKind::Remove(_), paths, .. }) => {
                    for path in &paths {
                        if let Some(name) = path.file_name() {
                            let _ = app.emit("sd-card-unmounted", name.to_string_lossy().to_string());
                        }
                    }
                }
                _ => {}
            }
        }
    });
}
```

- [ ] **Step 4: Register list_camera_volumes command and start watcher**

Update `src-tauri/src/lib.rs`:

```rust
mod photos;
mod import;
mod volumes;

use photos::scan_dcim;
use volumes::{list_camera_volumes, CameraVolume};

#[tauri::command]
fn list_photos(volume_path: String) -> Vec<photos::PhotoMeta> {
    scan_dcim(&volume_path)
}

#[tauri::command]
fn get_thumbnail(path: String) -> Result<String, String> {
    photos::get_thumbnail(&path)
}

#[tauri::command]
fn get_camera_volumes() -> Vec<CameraVolume> {
    list_camera_volumes()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_photos,
            get_thumbnail,
            get_camera_volumes,
        ])
        .setup(|app| {
            volumes::start_volume_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/volumes.rs src-tauri/src/lib.rs
git commit -m "feat: add SD card detection and volume watching"
```

---

### Task 5: Rust — Photos Import + Deletion Commands

**Files:**
- Modify: `src-tauri/src/import.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement import and delete functions**

Replace `src-tauri/src/import.rs`:

```rust
use serde::Serialize;
use std::fs;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<ImportError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportError {
    pub path: String,
    pub error: String,
}

pub fn import_to_photos(paths: &[String]) -> ImportResult {
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for path in paths {
        let script = format!(
            r#"tell application "Photos"
    activate
    import POSIX file "{}"
end tell"#,
            path.replace('\\', "\\\\").replace('"', "\\\"")
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match output {
            Ok(out) if out.status.success() => {
                succeeded.push(path.clone());
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                failed.push(ImportError {
                    path: path.clone(),
                    error: stderr,
                });
            }
            Err(e) => {
                failed.push(ImportError {
                    path: path.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    ImportResult { succeeded, failed }
}

pub fn delete_from_card(paths: &[String]) -> DeleteResult {
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for path in paths {
        match fs::remove_file(path) {
            Ok(()) => succeeded.push(path.clone()),
            Err(e) => failed.push(ImportError {
                path: path.clone(),
                error: e.to_string(),
            }),
        }
    }

    DeleteResult { succeeded, failed }
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<ImportError>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_delete_from_card_removes_files() {
        let tmp = tempdir().unwrap();
        let file_path = tmp.path().join("IMG_0001.JPG");
        File::create(&file_path).unwrap().write_all(b"data").unwrap();

        let paths = vec![file_path.to_str().unwrap().to_string()];
        let result = delete_from_card(&paths);

        assert_eq!(result.succeeded.len(), 1);
        assert_eq!(result.failed.len(), 0);
        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_nonexistent_file_fails() {
        let result = delete_from_card(&["/nonexistent/file.jpg".to_string()]);
        assert_eq!(result.succeeded.len(), 0);
        assert_eq!(result.failed.len(), 1);
    }
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test -- import
```

Expected: 2 tests pass.

- [ ] **Step 3: Register Tauri commands**

Add to `src-tauri/src/lib.rs`:

```rust
use import::{ImportResult, DeleteResult};

#[tauri::command]
fn import_to_photos(paths: Vec<String>) -> ImportResult {
    import::import_to_photos(&paths)
}

#[tauri::command]
fn delete_from_card(paths: Vec<String>) -> DeleteResult {
    import::delete_from_card(&paths)
}
```

Update the handler registration:

```rust
.invoke_handler(tauri::generate_handler![
    list_photos,
    get_thumbnail,
    get_camera_volumes,
    import_to_photos,
    delete_from_card,
])
```

- [ ] **Step 4: Run all tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/import.rs src-tauri/src/lib.rs
git commit -m "feat: add Photos import and SD card deletion commands"
```

---

### Task 6: Frontend — TypeScript Command Wrappers + Types

**Files:**
- Create: `src/lib/commands.ts`

- [ ] **Step 1: Create typed Tauri command wrappers**

Create `src/lib/commands.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";

export interface PhotoMeta {
  name: string;
  path: string;
  size: number;
  date: string;
}

export interface CameraVolume {
  name: string;
  path: string;
}

export interface ImportResult {
  succeeded: string[];
  failed: { path: string; error: string }[];
}

export interface DeleteResult {
  succeeded: string[];
  failed: { path: string; error: string }[];
}

export async function listPhotos(volumePath: string): Promise<PhotoMeta[]> {
  return invoke("list_photos", { volumePath });
}

export async function getThumbnail(path: string): Promise<string> {
  return invoke("get_thumbnail", { path });
}

export async function getCameraVolumes(): Promise<CameraVolume[]> {
  return invoke("get_camera_volumes");
}

export async function importToPhotos(
  paths: string[]
): Promise<ImportResult> {
  return invoke("import_to_photos", { paths });
}

export async function deleteFromCard(
  paths: string[]
): Promise<DeleteResult> {
  return invoke("delete_from_card", { paths });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/commands.ts
git commit -m "feat: add typed Tauri command wrappers"
```

---

### Task 7: Frontend — useSelection Hook

**Files:**
- Create: `src/hooks/useSelection.ts`
- Create: `src/__tests__/useSelection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/useSelection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelection } from "../hooks/useSelection";

describe("useSelection", () => {
  it("starts with empty selection", () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.count).toBe(0);
  });

  it("toggles a photo in and out", () => {
    const { result } = renderHook(() => useSelection());

    act(() => result.current.toggle("/path/a.jpg"));
    expect(result.current.isSelected("/path/a.jpg")).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle("/path/a.jpg"));
    expect(result.current.isSelected("/path/a.jpg")).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("selects all and deselects all", () => {
    const paths = ["/a.jpg", "/b.jpg", "/c.jpg"];
    const { result } = renderHook(() => useSelection());

    act(() => result.current.selectAll(paths));
    expect(result.current.count).toBe(3);

    act(() => result.current.deselectAll());
    expect(result.current.count).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/andy/Developer/photo-import
npx vitest run src/__tests__/useSelection.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useSelection**

Create `src/hooks/useSelection.ts`:

```ts
import { useCallback, useState } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((paths: string[]) => {
    setSelected(new Set(paths));
  }, []);

  const deselectAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback(
    (path: string) => selected.has(path),
    [selected]
  );

  return {
    selected,
    count: selected.size,
    toggle,
    selectAll,
    deselectAll,
    isSelected,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/useSelection.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSelection.ts src/__tests__/useSelection.test.ts
git commit -m "feat: add useSelection hook with tests"
```

---

### Task 8: Frontend — usePhotos Hook

**Files:**
- Create: `src/hooks/usePhotos.ts`
- Create: `src/__tests__/usePhotos.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/usePhotos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePhotos } from "../hooks/usePhotos";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("usePhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads photos when volumePath is provided", async () => {
    const mockPhotos = [
      { name: "IMG_0001.JPG", path: "/Volumes/SD/DCIM/IMG_0001.JPG", size: 5000000, date: "2026-03-28T10:00:00Z" },
      { name: "IMG_0002.JPG", path: "/Volumes/SD/DCIM/IMG_0002.JPG", size: 6000000, date: "2026-03-28T10:05:00Z" },
    ];
    mockInvoke.mockResolvedValueOnce(mockPhotos);

    const { result } = renderHook(() => usePhotos("/Volumes/SD"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.photos).toEqual(mockPhotos);
    expect(result.current.photos.length).toBe(2);
  });

  it("returns empty array when no volumePath", () => {
    const { result } = renderHook(() => usePhotos(null));
    expect(result.current.photos).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/usePhotos.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement usePhotos**

Create `src/hooks/usePhotos.ts`:

```ts
import { useEffect, useState } from "react";
import { listPhotos, PhotoMeta } from "../lib/commands";

export function usePhotos(volumePath: string | null) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!volumePath) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listPhotos(volumePath).then(
      (result) => {
        if (!cancelled) {
          setPhotos(result);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Failed to list photos:", err);
          setPhotos([]);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [volumePath]);

  return { photos, loading };
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/usePhotos.test.ts
```

Expected: All 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePhotos.ts src/__tests__/usePhotos.test.ts
git commit -m "feat: add usePhotos hook with tests"
```

---

### Task 9: Frontend — useSDCard Hook

**Files:**
- Create: `src/hooks/useSDCard.ts`

- [ ] **Step 1: Implement useSDCard**

Create `src/hooks/useSDCard.ts`:

```ts
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCameraVolumes, CameraVolume } from "../lib/commands";

export function useSDCard(autoDetect: boolean) {
  const [volume, setVolume] = useState<CameraVolume | null>(null);

  useEffect(() => {
    if (!autoDetect) return;

    // Check for already-mounted volumes on startup
    getCameraVolumes().then((volumes) => {
      if (volumes.length > 0) {
        setVolume(volumes[0]);
      }
    });

    // Listen for mount/unmount events
    const unlistenMount = listen<CameraVolume>("sd-card-mounted", (event) => {
      setVolume(event.payload);
    });

    const unlistenUnmount = listen<string>("sd-card-unmounted", () => {
      setVolume(null);
    });

    return () => {
      unlistenMount.then((fn) => fn());
      unlistenUnmount.then((fn) => fn());
    };
  }, [autoDetect]);

  return { volume };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useSDCard.ts
git commit -m "feat: add useSDCard hook for volume detection"
```

---

### Task 10: Frontend — Thumbnail Component

**Files:**
- Create: `src/components/Thumbnail.tsx`

- [ ] **Step 1: Implement Thumbnail component**

Create `src/components/Thumbnail.tsx`:

```tsx
import { useEffect, useState } from "react";
import { getThumbnail } from "../lib/commands";

interface ThumbnailProps {
  photo: { name: string; path: string };
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onPreview: () => void;
}

export function Thumbnail({
  photo,
  selected,
  focused,
  onSelect,
  onFocus,
  onPreview,
}: ThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getThumbnail(photo.path).then(
      (b64) => {
        if (!cancelled) setSrc(`data:image/jpeg;base64,${b64}`);
      },
      () => {} // silently fail — show placeholder
    );
    return () => {
      cancelled = true;
    };
  }, [photo.path]);

  return (
    <div
      className={`thumbnail ${selected ? "selected" : ""} ${focused ? "focused" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onFocus();
      }}
      onDoubleClick={onPreview}
    >
      {src ? (
        <img src={src} alt={photo.name} draggable={false} />
      ) : (
        <div className="thumbnail-placeholder" />
      )}
      <div
        className={`thumbnail-checkbox ${selected ? "checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {selected && "✓"}
      </div>
      <div className="thumbnail-name">{photo.name}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Thumbnail.tsx
git commit -m "feat: add Thumbnail component"
```

---

### Task 11: Frontend — Grid Component (Virtualized)

**Files:**
- Create: `src/components/Grid.tsx`
- Create: `src/__tests__/Grid.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/Grid.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Grid } from "../components/Grid";

// Mock Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

describe("Grid", () => {
  const mockPhotos = [
    { name: "IMG_0001.JPG", path: "/a/IMG_0001.JPG", size: 5000000, date: "2026-03-28T10:00:00Z" },
    { name: "IMG_0002.JPG", path: "/a/IMG_0002.JPG", size: 6000000, date: "2026-03-28T10:05:00Z" },
  ];

  it("renders photo count in empty state when no photos", () => {
    render(
      <Grid
        photos={[]}
        isSelected={() => false}
        focusedIndex={-1}
        onSelect={() => {}}
        onFocus={() => {}}
        onPreview={() => {}}
        columnCount={5}
      />
    );
    expect(screen.getByText(/no photos/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/Grid.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Grid component**

Create `src/components/Grid.tsx`:

```tsx
import { useRef, useCallback } from "react";
import { FixedSizeGrid, GridChildComponentProps } from "react-window";
import { PhotoMeta } from "../lib/commands";
import { Thumbnail } from "./Thumbnail";

interface GridProps {
  photos: PhotoMeta[];
  isSelected: (path: string) => boolean;
  focusedIndex: number;
  onSelect: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
  columnCount: number;
}

export function Grid({
  photos,
  isSelected,
  focusedIndex,
  onSelect,
  onFocus,
  onPreview,
  columnCount,
}: GridProps) {
  const gridRef = useRef<FixedSizeGrid>(null);

  const rowCount = Math.ceil(photos.length / columnCount);
  const cellSize = 200;

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
      const index = rowIndex * columnCount + columnIndex;
      if (index >= photos.length) return <div style={style} />;

      const photo = photos[index];
      return (
        <div style={{ ...style, padding: 4 }}>
          <Thumbnail
            photo={photo}
            selected={isSelected(photo.path)}
            focused={index === focusedIndex}
            onSelect={() => onSelect(photo.path)}
            onFocus={() => onFocus(index)}
            onPreview={() => onPreview(index)}
          />
        </div>
      );
    },
    [photos, isSelected, focusedIndex, onSelect, onFocus, onPreview, columnCount]
  );

  if (photos.length === 0) {
    return (
      <div className="grid-empty">
        <p>No photos found</p>
      </div>
    );
  }

  return (
    <div className="grid-container">
      <FixedSizeGrid
        ref={gridRef}
        columnCount={columnCount}
        columnWidth={cellSize}
        rowCount={rowCount}
        rowHeight={cellSize}
        width={columnCount * cellSize}
        height={600}
        overscanRowCount={2}
      >
        {Cell}
      </FixedSizeGrid>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/Grid.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Grid.tsx src/__tests__/Grid.test.tsx
git commit -m "feat: add virtualized Grid component"
```

---

### Task 12: Frontend — Preview Component

**Files:**
- Create: `src/components/Preview.tsx`
- Create: `src/__tests__/Preview.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/Preview.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Preview } from "../components/Preview";

describe("Preview", () => {
  const mockPhotos = [
    { name: "IMG_0001.JPG", path: "/a/IMG_0001.JPG", size: 5242880, date: "2026-03-28T10:00:00Z" },
    { name: "IMG_0002.JPG", path: "/a/IMG_0002.JPG", size: 6291456, date: "2026-03-28T10:05:00Z" },
  ];

  it("shows filename and position", () => {
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={() => {}}
        onNavigate={() => {}}
        onToggleSelect={() => {}}
      />
    );
    expect(screen.getByText("IMG_0001.JPG")).toBeTruthy();
    expect(screen.getByText(/1 of 2/)).toBeTruthy();
  });

  it("calls onClose when Esc is pressed", () => {
    const onClose = vi.fn();
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={onClose}
        onNavigate={() => {}}
        onToggleSelect={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onNavigate with +1 on ArrowRight", () => {
    const onNavigate = vi.fn();
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={() => {}}
        onNavigate={onNavigate}
        onToggleSelect={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("calls onToggleSelect on Space", () => {
    const onToggle = vi.fn();
    render(
      <Preview
        photos={mockPhotos}
        currentIndex={0}
        isSelected={false}
        onClose={() => {}}
        onNavigate={() => {}}
        onToggleSelect={onToggle}
      />
    );
    fireEvent.keyDown(document, { key: " " });
    expect(onToggle).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/Preview.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Preview component**

Create `src/components/Preview.tsx`:

```tsx
import { useEffect } from "react";
import { PhotoMeta } from "../lib/commands";
import { convertFileSrc } from "@tauri-apps/api/core";

interface PreviewProps {
  photos: PhotoMeta[];
  currentIndex: number;
  isSelected: boolean;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onToggleSelect: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Preview({
  photos,
  currentIndex,
  isSelected,
  onClose,
  onNavigate,
  onToggleSelect,
}: PreviewProps) {
  const photo = photos[currentIndex];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onNavigate(-1);
          break;
        case "ArrowRight":
          onNavigate(1);
          break;
        case " ":
          e.preventDefault();
          onToggleSelect();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, onToggleSelect]);

  const imageSrc = convertFileSrc(photo.path);

  return (
    <div className="preview-overlay">
      <div className="preview-topbar">
        <div className="preview-info">
          <span className="preview-filename">{photo.name}</span>
          <span className="preview-meta">
            {formatSize(photo.size)} — {new Date(photo.date).toLocaleDateString()}
          </span>
        </div>
        <div className="preview-nav-info">
          <span>
            {currentIndex + 1} of {photos.length}
          </span>
          <button className="preview-close" onClick={onClose}>
            Esc ✕
          </button>
        </div>
      </div>

      <div className="preview-body">
        <button
          className="preview-arrow preview-arrow-left"
          onClick={() => onNavigate(-1)}
        >
          ←
        </button>

        <img
          className="preview-image"
          src={imageSrc}
          alt={photo.name}
          draggable={false}
        />

        <button
          className="preview-arrow preview-arrow-right"
          onClick={() => onNavigate(1)}
        >
          →
        </button>
      </div>

      <div className="preview-bottombar">
        <label className="preview-select-toggle">
          <div
            className={`thumbnail-checkbox ${isSelected ? "checked" : ""}`}
            onClick={onToggleSelect}
          >
            {isSelected && "✓"}
          </div>
          <span>Select for import</span>
        </label>
        <span className="preview-shortcuts">
          ← → navigate &nbsp;&nbsp; Space select &nbsp;&nbsp; Esc close
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/Preview.test.tsx
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/Preview.tsx src/__tests__/Preview.test.tsx
git commit -m "feat: add Preview component with keyboard navigation"
```

---

### Task 13: Frontend — TopBar, Toolbar, ActionBar Components

**Files:**
- Create: `src/components/TopBar.tsx`
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/ActionBar.tsx`

- [ ] **Step 1: Implement TopBar**

Create `src/components/TopBar.tsx`:

```tsx
interface TopBarProps {
  volumeName: string | null;
  photoCount: number;
  autoDetect: boolean;
  onToggleAutoDetect: () => void;
}

export function TopBar({
  volumeName,
  photoCount,
  autoDetect,
  onToggleAutoDetect,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-status">
        <span
          className={`status-dot ${volumeName ? "connected" : "disconnected"}`}
        />
        <span className="topbar-label">
          {volumeName
            ? `${volumeName} — ${photoCount} photos`
            : "No SD card detected"}
        </span>
      </div>
      <div className="topbar-toggle">
        <span className="toggle-label">Auto-detect</span>
        <button
          className={`toggle ${autoDetect ? "on" : "off"}`}
          onClick={onToggleAutoDetect}
          role="switch"
          aria-checked={autoDetect}
        >
          <span className="toggle-knob" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement Toolbar**

Create `src/components/Toolbar.tsx`:

```tsx
type SortBy = "name" | "date";

interface ToolbarProps {
  selectedCount: number;
  totalCount: number;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  columnCount: number;
  onColumnCountChange: (count: number) => void;
}

export function Toolbar({
  selectedCount,
  totalCount,
  sortBy,
  onSortChange,
  onSelectAll,
  onDeselectAll,
  columnCount,
  onColumnCountChange,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onSelectAll}>
          Select All
        </button>
        <button className="toolbar-btn" onClick={onDeselectAll}>
          Deselect All
        </button>
        {selectedCount > 0 && (
          <span className="toolbar-count">{selectedCount} selected</span>
        )}
      </div>
      <div className="toolbar-right">
        <select
          className="toolbar-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
        >
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
        </select>
        <label className="toolbar-grid-size">
          Grid
          <input
            type="range"
            min={3}
            max={8}
            value={columnCount}
            onChange={(e) => onColumnCountChange(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement ActionBar**

Create `src/components/ActionBar.tsx`:

```tsx
interface ActionBarProps {
  selectedCount: number;
  deleteAfterImport: boolean;
  onToggleDelete: () => void;
  onImport: () => void;
  importing: boolean;
}

export function ActionBar({
  selectedCount,
  deleteAfterImport,
  onToggleDelete,
  onImport,
  importing,
}: ActionBarProps) {
  return (
    <div className="actionbar">
      <label className="actionbar-delete-toggle">
        <input
          type="checkbox"
          checked={deleteAfterImport}
          onChange={onToggleDelete}
        />
        Delete from SD card after import
      </label>
      <button
        className="actionbar-import-btn"
        disabled={selectedCount === 0 || importing}
        onClick={onImport}
      >
        {importing
          ? "Importing..."
          : `Import ${selectedCount} Photo${selectedCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBar.tsx src/components/Toolbar.tsx src/components/ActionBar.tsx
git commit -m "feat: add TopBar, Toolbar, and ActionBar components"
```

---

### Task 14: Frontend — ImportDialog Component

**Files:**
- Create: `src/components/ImportDialog.tsx`
- Create: `src/__tests__/ImportDialog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/ImportDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportDialog } from "../components/ImportDialog";

describe("ImportDialog", () => {
  it("shows confirmation with photo count", () => {
    render(
      <ImportDialog
        stage="confirm"
        photoCount={5}
        deleteAfterImport={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        progress={null}
      />
    );
    expect(screen.getByText(/Import 5 photos into Photos\?/)).toBeTruthy();
  });

  it("shows progress during import", () => {
    render(
      <ImportDialog
        stage="importing"
        photoCount={10}
        deleteAfterImport={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        progress={{ current: 3, total: 10, currentFile: "IMG_0003.JPG" }}
      />
    );
    expect(screen.getByText(/IMG_0003.JPG/)).toBeTruthy();
    expect(screen.getByText(/3 of 10/)).toBeTruthy();
  });

  it("shows delete confirmation when deleteAfterImport is true", () => {
    render(
      <ImportDialog
        stage="confirm-delete"
        photoCount={5}
        deleteAfterImport={true}
        onConfirm={() => {}}
        onCancel={() => {}}
        progress={null}
      />
    );
    expect(screen.getByText(/Delete 5 imported photos from SD card/)).toBeTruthy();
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/ImportDialog.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ImportDialog**

Create `src/components/ImportDialog.tsx`:

```tsx
export type ImportStage = "confirm" | "importing" | "confirm-delete" | "deleting" | "done";

export interface ImportProgress {
  current: number;
  total: number;
  currentFile: string;
}

interface ImportDialogProps {
  stage: ImportStage;
  photoCount: number;
  deleteAfterImport: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  progress: ImportProgress | null;
}

export function ImportDialog({
  stage,
  photoCount,
  deleteAfterImport,
  onConfirm,
  onCancel,
  progress,
}: ImportDialogProps) {
  return (
    <div className="dialog-overlay">
      <div className="dialog">
        {stage === "confirm" && (
          <>
            <h3>Import {photoCount} photos into Photos?</h3>
            {deleteAfterImport && (
              <p className="dialog-note">
                Photos will be deleted from SD card after import.
              </p>
            )}
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={onCancel}>
                Cancel
              </button>
              <button className="dialog-btn primary" onClick={onConfirm}>
                Import
              </button>
            </div>
          </>
        )}

        {stage === "importing" && progress && (
          <>
            <h3>Importing photos...</h3>
            <p className="dialog-progress-file">{progress.currentFile}</p>
            <div className="dialog-progress-bar">
              <div
                className="dialog-progress-fill"
                style={{
                  width: `${(progress.current / progress.total) * 100}%`,
                }}
              />
            </div>
            <p className="dialog-progress-count">
              {progress.current} of {progress.total}
            </p>
          </>
        )}

        {stage === "confirm-delete" && (
          <>
            <h3>Delete {photoCount} imported photos from SD card?</h3>
            <p className="dialog-warning">This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={onCancel}>
                Keep on Card
              </button>
              <button className="dialog-btn danger" onClick={onConfirm}>
                Delete
              </button>
            </div>
          </>
        )}

        {stage === "deleting" && (
          <>
            <h3>Deleting from SD card...</h3>
          </>
        )}

        {stage === "done" && (
          <>
            <h3>Import complete!</h3>
            <p>{photoCount} photos imported successfully.</p>
            <div className="dialog-actions">
              <button className="dialog-btn primary" onClick={onCancel}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/ImportDialog.test.tsx
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportDialog.tsx src/__tests__/ImportDialog.test.tsx
git commit -m "feat: add ImportDialog with confirmation and progress states"
```

---

### Task 15: Frontend — App Composition + Styles

**Files:**
- Modify: `src/App.tsx`
- Create: `src/App.css`

- [ ] **Step 1: Implement App.tsx — root component wiring everything together**

Replace `src/App.tsx`:

```tsx
import { useState, useCallback, useMemo } from "react";
import { useSelection } from "./hooks/useSelection";
import { usePhotos } from "./hooks/usePhotos";
import { useSDCard } from "./hooks/useSDCard";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { Grid } from "./components/Grid";
import { Preview } from "./components/Preview";
import { ActionBar } from "./components/ActionBar";
import {
  ImportDialog,
  ImportStage,
  ImportProgress,
} from "./components/ImportDialog";
import { importToPhotos, deleteFromCard } from "./lib/commands";
import "./App.css";

type SortBy = "name" | "date";

export default function App() {
  const [autoDetect, setAutoDetect] = useState(true);
  const { volume } = useSDCard(autoDetect);
  const { photos: rawPhotos, loading } = usePhotos(volume?.path ?? null);
  const selection = useSelection();

  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [columnCount, setColumnCount] = useState(5);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleteAfterImport, setDeleteAfterImport] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null
  );
  const [importedPaths, setImportedPaths] = useState<Set<string>>(new Set());

  const photos = useMemo(() => {
    const sorted = [...rawPhotos];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => a.date.localeCompare(b.date));
    }
    return sorted;
  }, [rawPhotos, sortBy]);

  // Grid keyboard handler
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (previewIndex !== null) return;
      if (e.key === " " && focusedIndex >= 0) {
        e.preventDefault();
        setPreviewIndex(focusedIndex);
      }
    },
    [focusedIndex, previewIndex]
  );

  // Preview navigation
  const handlePreviewNavigate = useCallback(
    (delta: number) => {
      setPreviewIndex((prev) => {
        if (prev === null) return null;
        const next = prev + delta;
        if (next < 0) return photos.length - 1;
        if (next >= photos.length) return 0;
        return next;
      });
    },
    [photos.length]
  );

  // Import flow
  const handleImport = useCallback(async () => {
    const paths = Array.from(selection.selected);
    setImportStage("confirm");
  }, [selection.selected]);

  const handleImportConfirm = useCallback(async () => {
    const paths = Array.from(selection.selected);

    if (importStage === "confirm") {
      setImportStage("importing");

      // Import one by one for progress
      const succeeded: string[] = [];
      for (let i = 0; i < paths.length; i++) {
        setImportProgress({
          current: i + 1,
          total: paths.length,
          currentFile: paths[i].split("/").pop() ?? paths[i],
        });
        const result = await importToPhotos([paths[i]]);
        if (result.succeeded.length > 0) {
          succeeded.push(paths[i]);
        }
      }

      setImportedPaths((prev) => {
        const next = new Set(prev);
        succeeded.forEach((p) => next.add(p));
        return next;
      });

      if (deleteAfterImport && succeeded.length > 0) {
        setImportStage("confirm-delete");
      } else {
        setImportStage("done");
      }
    } else if (importStage === "confirm-delete") {
      setImportStage("deleting");
      await deleteFromCard(Array.from(selection.selected));
      setImportStage("done");
    }
  }, [importStage, selection.selected, deleteAfterImport]);

  const handleImportCancel = useCallback(() => {
    setImportStage(null);
    setImportProgress(null);
  }, []);

  return (
    <div className="app" onKeyDown={handleGridKeyDown} tabIndex={0}>
      <TopBar
        volumeName={volume?.name ?? null}
        photoCount={photos.length}
        autoDetect={autoDetect}
        onToggleAutoDetect={() => setAutoDetect((v) => !v)}
      />
      <Toolbar
        selectedCount={selection.count}
        totalCount={photos.length}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onSelectAll={() => selection.selectAll(photos.map((p) => p.path))}
        onDeselectAll={selection.deselectAll}
        columnCount={columnCount}
        onColumnCountChange={setColumnCount}
      />

      {loading ? (
        <div className="grid-empty">
          <p>Loading photos...</p>
        </div>
      ) : (
        <Grid
          photos={photos}
          isSelected={selection.isSelected}
          focusedIndex={focusedIndex}
          onSelect={selection.toggle}
          onFocus={setFocusedIndex}
          onPreview={setPreviewIndex}
          columnCount={columnCount}
        />
      )}

      <ActionBar
        selectedCount={selection.count}
        deleteAfterImport={deleteAfterImport}
        onToggleDelete={() => setDeleteAfterImport((v) => !v)}
        onImport={handleImport}
        importing={importStage === "importing"}
      />

      {previewIndex !== null && (
        <Preview
          photos={photos}
          currentIndex={previewIndex}
          isSelected={selection.isSelected(photos[previewIndex]?.path)}
          onClose={() => setPreviewIndex(null)}
          onNavigate={handlePreviewNavigate}
          onToggleSelect={() =>
            selection.toggle(photos[previewIndex]?.path)
          }
        />
      )}

      {importStage && (
        <ImportDialog
          stage={importStage}
          photoCount={selection.count}
          deleteAfterImport={deleteAfterImport}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
          progress={importProgress}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create App.css with all styles**

Create `src/App.css`:

```css
/* === Base === */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f0f0f;
  color: #e0e0e0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  outline: none;
}

/* === TopBar === */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.topbar-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot.connected {
  background: #4ade80;
}

.status-dot.disconnected {
  background: #666;
}

.topbar-label {
  font-size: 14px;
  font-weight: 600;
}

.topbar-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}

.toggle.on {
  background: #6366f1;
}

.toggle.off {
  background: #444;
}

.toggle-knob {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  position: absolute;
  top: 2px;
  transition: left 0.2s;
}

.toggle.on .toggle-knob {
  left: 18px;
}

.toggle.off .toggle-knob {
  left: 2px;
}

/* === Toolbar === */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.toolbar-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  padding-left: 8px;
}

.toolbar-select {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 12px;
}

.toolbar-grid-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.toolbar-grid-size input[type="range"] {
  width: 80px;
}

/* === Grid === */
.grid-container {
  flex: 1;
  overflow: auto;
  padding: 8px;
  display: flex;
  justify-content: center;
}

.grid-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.4);
}

/* === Thumbnail === */
.thumbnail {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s, box-shadow 0.15s;
}

.thumbnail:hover {
  opacity: 0.9;
}

.thumbnail.selected {
  opacity: 1;
  box-shadow: 0 0 0 3px #6366f1;
}

.thumbnail.focused {
  box-shadow: 0 0 0 2px #a5b4fc, 0 0 12px rgba(99, 102, 241, 0.3);
  opacity: 1;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.05);
}

.thumbnail-checkbox {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  cursor: pointer;
}

.thumbnail-checkbox.checked {
  background: #6366f1;
  border-color: #6366f1;
}

.thumbnail-name {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 5px;
  border-radius: 3px;
}

/* === Preview === */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.preview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.6);
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-filename {
  font-size: 14px;
  font-weight: 600;
}

.preview-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.preview-nav-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.preview-close {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 12px;
  cursor: pointer;
}

.preview-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 0;
}

.preview-image {
  max-width: 90%;
  max-height: 100%;
  object-fit: contain;
}

.preview-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-arrow:hover {
  background: rgba(255, 255, 255, 0.2);
}

.preview-arrow-left {
  left: 16px;
}

.preview-arrow-right {
  right: 16px;
}

.preview-bottombar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.6);
}

.preview-select-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.preview-shortcuts {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

/* === ActionBar === */
.actionbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.actionbar-delete-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.actionbar-import-btn {
  padding: 8px 24px;
  background: #6366f1;
  border: none;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
}

.actionbar-import-btn:hover:not(:disabled) {
  background: #5558e6;
}

.actionbar-import-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* === Dialog === */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog {
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  min-width: 360px;
  max-width: 440px;
}

.dialog h3 {
  margin-bottom: 12px;
  font-size: 16px;
}

.dialog-note {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16px;
}

.dialog-warning {
  font-size: 13px;
  color: #f87171;
  margin-bottom: 16px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.dialog-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.dialog-btn.primary {
  background: #6366f1;
  color: white;
}

.dialog-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.dialog-btn.danger {
  background: #dc2626;
  color: white;
}

.dialog-progress-file {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}

.dialog-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.dialog-progress-fill {
  height: 100%;
  background: #6366f1;
  transition: width 0.3s;
}

.dialog-progress-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 8px;
  text-align: center;
}
```

- [ ] **Step 3: Update main.tsx entry point**

Ensure `src/main.tsx` contains:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 4: Verify it builds**

```bash
cd /Users/andy/Developer/photo-import
npm run tauri dev
```

Expected: App window opens showing "No SD card detected" in the top bar, empty grid with "No photos found", and the action bar at the bottom.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.css src/main.tsx
git commit -m "feat: wire up App with all components and styles"
```

---

### Task 16: Config Persistence

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add config read/write using Tauri's fs plugin**

Install the Tauri store plugin:

```bash
cd /Users/andy/Developer/photo-import
npm install @tauri-apps/plugin-store
```

Add to `src-tauri/Cargo.toml` dependencies:

```toml
tauri-plugin-store = "2"
```

- [ ] **Step 2: Register the store plugin in lib.rs**

Update `src-tauri/src/lib.rs` — in the builder chain, add before `.run()`:

```rust
.plugin(tauri_plugin_store::Builder::new().build())
```

- [ ] **Step 3: Update App.tsx to persist autoDetect**

Add to the top of `App.tsx`:

```tsx
import { LazyStore } from "@tauri-apps/plugin-store";

const store = new LazyStore("config.json");
```

Replace the `autoDetect` state initialization and toggle:

```tsx
const [autoDetect, setAutoDetect] = useState(true);

// Load persisted config on mount
useEffect(() => {
  store.get<boolean>("autoDetect").then((val) => {
    if (val !== null && val !== undefined) setAutoDetect(val);
  });
}, []);

const toggleAutoDetect = useCallback(() => {
  setAutoDetect((prev) => {
    const next = !prev;
    store.set("autoDetect", next).then(() => store.save());
    return next;
  });
}, []);
```

Update the `TopBar` prop from `onToggleAutoDetect={() => setAutoDetect((v) => !v)}` to `onToggleAutoDetect={toggleAutoDetect}`.

- [ ] **Step 4: Verify it builds**

```bash
npm run tauri dev
```

Expected: Toggle auto-detect off, restart app, toggle should still be off.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src-tauri/src/lib.rs src-tauri/Cargo.toml package.json package-lock.json
git commit -m "feat: persist auto-detect preference with Tauri store"
```

---

### Task 17: Polish — Grid Auto-sizing + Responsive Width

**Files:**
- Modify: `src/components/Grid.tsx`

- [ ] **Step 1: Make Grid responsive to container width**

Update `src/components/Grid.tsx` to use a resize observer:

```tsx
import { useRef, useCallback, useState, useEffect } from "react";
import { FixedSizeGrid, GridChildComponentProps } from "react-window";
import { PhotoMeta } from "../lib/commands";
import { Thumbnail } from "./Thumbnail";

interface GridProps {
  photos: PhotoMeta[];
  isSelected: (path: string) => boolean;
  focusedIndex: number;
  onSelect: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
  columnCount: number;
}

export function Grid({
  photos,
  isSelected,
  focusedIndex,
  onSelect,
  onFocus,
  onPreview,
  columnCount,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<FixedSizeGrid>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cellWidth = Math.floor(dimensions.width / columnCount);
  const cellHeight = Math.floor(cellWidth * 0.72); // ~3:2 + padding
  const rowCount = Math.ceil(photos.length / columnCount);

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
      const index = rowIndex * columnCount + columnIndex;
      if (index >= photos.length) return <div style={style} />;

      const photo = photos[index];
      return (
        <div style={{ ...style, padding: 4 }}>
          <Thumbnail
            photo={photo}
            selected={isSelected(photo.path)}
            focused={index === focusedIndex}
            onSelect={() => onSelect(photo.path)}
            onFocus={() => onFocus(index)}
            onPreview={() => onPreview(index)}
          />
        </div>
      );
    },
    [photos, isSelected, focusedIndex, onSelect, onFocus, onPreview, columnCount]
  );

  if (photos.length === 0) {
    return (
      <div className="grid-empty">
        <p>No photos found</p>
      </div>
    );
  }

  return (
    <div className="grid-container" ref={containerRef}>
      <FixedSizeGrid
        ref={gridRef}
        columnCount={columnCount}
        columnWidth={cellWidth}
        rowCount={rowCount}
        rowHeight={cellHeight}
        width={dimensions.width}
        height={dimensions.height}
        overscanRowCount={2}
      >
        {Cell}
      </FixedSizeGrid>
    </div>
  );
}
```

- [ ] **Step 2: Run all frontend tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Grid.tsx
git commit -m "feat: make Grid responsive with ResizeObserver"
```

---

### Task 18: End-to-End Smoke Test

**Files:** None new — manual verification.

- [ ] **Step 1: Build the full app**

```bash
cd /Users/andy/Developer/photo-import
npm run tauri build
```

Expected: Builds successfully, produces `.app` bundle in `src-tauri/target/release/bundle/macos/`.

- [ ] **Step 2: Run all backend tests**

```bash
cd /Users/andy/Developer/photo-import/src-tauri
cargo test
```

Expected: All tests pass.

- [ ] **Step 3: Run all frontend tests**

```bash
cd /Users/andy/Developer/photo-import
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Manual smoke test with SD card**

1. Insert an SD card with JPEG photos
2. Run `npm run tauri dev`
3. Verify: top bar shows SD card name + photo count
4. Verify: thumbnails load in grid
5. Verify: clicking checkbox selects/deselects photos
6. Verify: Select All / Deselect All work
7. Verify: double-click opens preview
8. Verify: arrow keys navigate in preview
9. Verify: Space toggles selection in preview
10. Verify: Esc returns to grid
11. Verify: Import button imports to Photos.app
12. Verify: eject SD card → top bar shows "No SD card detected"

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final polish and verification"
```
