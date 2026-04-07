# Two-Pass Thumbnail Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conditionally load higher-resolution thumbnails when the EXIF-embedded thumbnail is too small for the rendered grid cell, improving sharpness on Retina displays and large grid sizes.

**Architecture:** Add a `get_thumbnail_hq` Rust command that always resizes from the full source image. On the frontend, after the first-pass thumbnail loads, measure its `naturalWidth` against `cellWidth * devicePixelRatio * 0.5`. If too small, queue an HQ request through a separate low-concurrency queue. Swap the src when the HQ thumbnail arrives.

**Tech Stack:** Rust (image crate), TypeScript, React, Tauri v2

---

### Task 1: Add `get_thumbnail_hq` backend command

**Files:**
- Modify: `src-tauri/src/photos.rs:11-14` (add HQ cache), add `get_thumbnail_hq` function
- Modify: `src-tauri/src/lib.rs` (register command + add async wrapper)
- Modify: `src/lib/commands.ts` (add TypeScript wrapper)

- [ ] **Step 1: Add HQ thumbnail cache and resize function**

In `src-tauri/src/photos.rs`, after line 12 (the existing `THUMBNAIL_CACHE`), add a separate HQ cache:

```rust
static HQ_THUMBNAIL_CACHE: std::sync::LazyLock<Mutex<HashMap<String, String>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));
```

- [ ] **Step 2: Add `resize_and_encode_width` function**

After the existing `resize_and_encode` function (line 429), add:

```rust
fn resize_and_encode_width(img: image::DynamicImage, width: u32) -> Result<String, String> {
    let resized = img.resize(width, u32::MAX, FilterType::Triangle);
    let mut buf = std::io::Cursor::new(Vec::new());
    resized
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}
```

- [ ] **Step 3: Add `get_thumbnail_hq` function**

After `get_thumbnail` (line 461), add:

```rust
pub fn get_thumbnail_hq(path: &str, width: u32) -> Result<String, String> {
    let width = width.min(800);
    let cache_key = format!("{path}_hq_{width}");

    {
        let cache = HQ_THUMBNAIL_CACHE.lock().map_err(|e| e.to_string())?;
        if let Some(cached) = cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }

    let b64 = if is_video(path) {
        let img = extract_video_frame(path)?;
        resize_and_encode_width(img, width)?
    } else {
        let orientation = read_orientation(path);
        let img = image::open(path)
            .map_err(|e| format!("Failed to open image: {e}"))?;
        let img = apply_orientation(img, orientation);
        resize_and_encode_width(img, width)?
    };

    let mut cache = HQ_THUMBNAIL_CACHE.lock().map_err(|e| e.to_string())?;
    cache.insert(cache_key, b64.clone());
    Ok(b64)
}
```

- [ ] **Step 4: Also clear HQ cache in `clear_thumbnail_cache`**

Update `clear_thumbnail_cache` at line 538:

```rust
pub fn clear_thumbnail_cache() {
    if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
        cache.clear();
    }
    if let Ok(mut cache) = HQ_THUMBNAIL_CACHE.lock() {
        cache.clear();
    }
}
```

- [ ] **Step 5: Register the Tauri command in `lib.rs`**

In `src-tauri/src/lib.rs`, add the command handler after `get_thumbnail` (around line 42):

```rust
#[tauri::command]
async fn get_thumbnail_hq(path: String, width: u32) -> Result<String, String> {
    tokio::task::spawn_blocking(move || photos::get_thumbnail_hq(&path, width))
        .await
        .map_err(|e| e.to_string())?
}
```

Add `get_thumbnail_hq` to the `generate_handler!` macro (after `get_thumbnail` in the list).

- [ ] **Step 6: Add TypeScript invoke wrapper**

In `src/lib/commands.ts`, after the `getThumbnail` function (line 51), add:

```typescript
export async function getThumbnailHq(path: string, width: number): Promise<string> {
  return invoke("get_thumbnail_hq", { path, width });
}
```

- [ ] **Step 7: Verify build**

Run: `cd /Users/andy/Developer/photo-import && npx vite build 2>&1 | tail -20`
Expected: Build succeeds (frontend compiles; Rust compiles on next `cargo build`).

Run: `cd /Users/andy/Developer/photo-import && cd src-tauri && cargo check 2>&1 | tail -20`
Expected: Compiles without errors.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/photos.rs src-tauri/src/lib.rs src/lib/commands.ts
git commit -m "feat: add get_thumbnail_hq command for high-res thumbnails"
```

---

### Task 2: Add HQ thumbnail queue

**Files:**
- Modify: `src/lib/thumbnailQueue.ts`

- [ ] **Step 1: Add HQ queue with concurrency 2**

Add the following after the existing `cancelPending` function (line 42) in `src/lib/thumbnailQueue.ts`:

```typescript
// --- HQ thumbnail queue (lower concurrency, separate from first-pass) ---

const HQ_MAX_CONCURRENT = 2;
let hqActive = 0;
const hqQueue: Array<{
  path: string;
  width: number;
  resolve: (src: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processHqQueue() {
  while (hqActive < HQ_MAX_CONCURRENT && hqQueue.length > 0) {
    const item = hqQueue.shift()!;
    hqActive++;
    getThumbnailHq(item.path, item.width)
      .then((b64) => {
        item.resolve(`data:image/jpeg;base64,${b64}`);
      })
      .catch((err) => {
        item.reject(err);
      })
      .finally(() => {
        hqActive--;
        processHqQueue();
      });
  }
}

export function queueThumbnailHq(path: string, width: number): Promise<string> {
  return new Promise((resolve, reject) => {
    hqQueue.push({ path, width, resolve, reject });
    processHqQueue();
  });
}

export function cancelPendingHq(path: string) {
  const idx = hqQueue.findIndex((item) => item.path === path);
  if (idx !== -1) {
    hqQueue.splice(idx, 1);
  }
}
```

- [ ] **Step 2: Add import for `getThumbnailHq`**

Update the import at line 1:

```typescript
import { getThumbnail, getThumbnailHq } from "./commands";
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/andy/Developer/photo-import && npx vite build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/thumbnailQueue.ts
git commit -m "feat: add HQ thumbnail queue with concurrency 2"
```

---

### Task 3: Add HQ upgrade logic to Thumbnail component

**Files:**
- Modify: `src/components/Grid.tsx` (pass `cellWidth` to Thumbnail)
- Modify: `src/components/Thumbnail.tsx` (add HQ upgrade logic)

- [ ] **Step 1: Pass `cellWidth` to Thumbnail in Grid**

In `src/components/Grid.tsx`, the `Thumbnail` is rendered around line 99. Add `cellWidth` prop:

```tsx
            <Thumbnail
              photo={photo}
              selected={isSelected(photo.path)}
              focused={focusedIndex === absIdx}
              onSelect={() => onSelect(absIdx)}
              onFocus={() => onFocus(absIdx)}
              onPreview={() => onPreview(absIdx)}
              burstInfo={burstMap?.get(photo.path)}
              hasRawPair={rawPairMap?.has(photo.path)}
              detection={detectionMap?.get(photo.path)}
              isBurstCover={groupBursts && (burstMap?.get(photo.path)?.burstCount ?? 0) > 1}
              burstSelectedCount={groupBursts ? burstSelectedMap?.get(photo.path) : undefined}
              cellWidth={cellWidth}
            />
```

- [ ] **Step 2: Add `cellWidth` prop and HQ logic to Thumbnail**

In `src/components/Thumbnail.tsx`, update the interface at line 8 to add:

```typescript
  cellWidth: number;
```

Add `cellWidth` to the destructured props.

Replace the existing thumbnail loading `useEffect` (lines 38-50) with two effects — the first-pass loader and the HQ upgrade:

```tsx
  const imgRef = useRef<HTMLImageElement>(null);
  const [hqSrc, setHqSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setHqSrc(null);
    queueThumbnail(photo.path).then(
      (dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      },
      () => {}
    );
    return () => {
      cancelled = true;
      cancelPending(photo.path);
    };
  }, [photo.path]);

  // HQ upgrade: after first-pass loads, check if resolution is sufficient
  useEffect(() => {
    if (!src || !imgRef.current) return;
    const img = imgRef.current;
    const naturalW = img.naturalWidth;
    if (naturalW === 0) return; // not loaded yet
    const needed = cellWidth * window.devicePixelRatio * 0.5;
    if (naturalW >= needed) return; // sharp enough

    let cancelled = false;
    const targetWidth = Math.min(Math.ceil(cellWidth * window.devicePixelRatio), 800);
    queueThumbnailHq(photo.path, targetWidth).then(
      (dataUrl) => {
        if (!cancelled) setHqSrc(dataUrl);
      },
      () => {}
    );
    return () => {
      cancelled = true;
      cancelPendingHq(photo.path);
    };
  }, [src, cellWidth, photo.path]);
```

- [ ] **Step 3: Update the `<img>` element**

Replace the img tag (line 88) with:

```tsx
        <img
          ref={imgRef}
          src={hqSrc ?? src}
          alt={photo.name}
          draggable={false}
          onLoad={() => {
            // Trigger HQ check after first-pass image loads
            if (!hqSrc && imgRef.current) {
              const naturalW = imgRef.current.naturalWidth;
              const needed = cellWidth * window.devicePixelRatio * 0.5;
              if (naturalW < needed) {
                const targetWidth = Math.min(Math.ceil(cellWidth * window.devicePixelRatio), 800);
                queueThumbnailHq(photo.path, targetWidth).then(
                  (dataUrl) => setHqSrc(dataUrl),
                  () => {}
                );
              }
            }
          }}
        />
```

Wait — this duplicates the HQ logic. Let me simplify. The `useEffect` approach won't reliably have `naturalWidth` available because the image may not have loaded when the effect runs. Better to use `onLoad` as the sole trigger:

Replace the HQ useEffect and img tag with this cleaner approach:

Remove the HQ useEffect entirely. Keep only the first-pass useEffect. Update the img:

```tsx
        <img
          ref={imgRef}
          src={hqSrc ?? src}
          alt={photo.name}
          draggable={false}
          onLoad={() => {
            if (hqSrc) return; // Already upgraded
            const img = imgRef.current;
            if (!img) return;
            const needed = cellWidth * window.devicePixelRatio * 0.5;
            if (img.naturalWidth >= needed) return;
            const targetWidth = Math.min(Math.ceil(cellWidth * window.devicePixelRatio), 800);
            queueThumbnailHq(photo.path, targetWidth).then(
              (dataUrl) => setHqSrc(dataUrl),
              () => {}
            );
          }}
        />
```

And add a separate effect to re-evaluate when `cellWidth` changes (zoom in):

```tsx
  // Re-evaluate HQ need when cell size changes (user zooms grid)
  useEffect(() => {
    if (!src || hqSrc) return; // No first-pass yet, or already upgraded
    const img = imgRef.current;
    if (!img || img.naturalWidth === 0) return;
    const needed = cellWidth * window.devicePixelRatio * 0.5;
    if (img.naturalWidth >= needed) return;
    let cancelled = false;
    const targetWidth = Math.min(Math.ceil(cellWidth * window.devicePixelRatio), 800);
    queueThumbnailHq(photo.path, targetWidth).then(
      (dataUrl) => {
        if (!cancelled) setHqSrc(dataUrl);
      },
      () => {}
    );
    return () => {
      cancelled = true;
      cancelPendingHq(photo.path);
    };
  }, [cellWidth, src, hqSrc, photo.path]);
```

- [ ] **Step 4: Add imports**

At the top of `Thumbnail.tsx`, update the import from thumbnailQueue:

```typescript
import { queueThumbnail, cancelPending, queueThumbnailHq, cancelPendingHq } from "../lib/thumbnailQueue";
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/andy/Developer/photo-import && npx vite build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/Thumbnail.tsx src/components/Grid.tsx
git commit -m "feat: two-pass thumbnail loading with conditional HQ upgrade"
```

---

### Task 4: Update tests

**Files:**
- Modify: `src/__tests__/Grid.test.tsx` (add `cellWidth` to mock Thumbnail calls if needed)

- [ ] **Step 1: Check Grid.test.tsx for Thumbnail mock**

Read `src/__tests__/Grid.test.tsx`. If it mocks or renders Thumbnail and needs the new `cellWidth` prop, add it. The Grid component calculates `cellWidth` internally from `dimensions.width / columnCount`, so Grid tests likely don't need changes. But if Thumbnail is rendered directly in any test, add `cellWidth={200}` to its props.

- [ ] **Step 2: Run all tests**

Run: `cd /Users/andy/Developer/photo-import && npx vitest run 2>&1 | tail -30`
Expected: All tests pass.

- [ ] **Step 3: Run Rust tests**

Run: `cd /Users/andy/Developer/photo-import/src-tauri && cargo test 2>&1 | tail -20`
Expected: All tests pass.

- [ ] **Step 4: Commit if changes were made**

```bash
git add -A && git commit -m "test: update tests for two-pass thumbnail loading"
```
