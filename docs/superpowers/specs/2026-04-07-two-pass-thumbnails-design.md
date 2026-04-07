# Two-Pass Thumbnail Loading

**Date:** 2026-04-07

## Problem

Thumbnails are generated from EXIF embedded thumbnails (typically 160-320px). On Retina displays (2x), even moderate grid cells (300px CSS = 600px physical) cause visible quality degradation. The app needs higher-res thumbnails for larger grid sizes without sacrificing the fast initial load.

## Design

### Two-Pass Loading Model

1. **First pass (instant):** Existing `get_thumbnail` — extracts EXIF embedded thumbnail, resizes to 400px max width, returns base64 JPEG. Displayed immediately.

2. **Measure:** After the `<img>` loads, compare `img.naturalWidth` against `cellWidth * window.devicePixelRatio * 0.5`. If the thumbnail's natural width exceeds this threshold, it's sharp enough — stop here.

3. **Second pass (conditional):** If the thumbnail is too small for the rendered size, request `get_thumbnail_hq` from the backend. This always resizes from the full source image (never the EXIF embedded thumb), producing a sharper result.

### Threshold

`exifThumbWidth < cellWidth * devicePixelRatio * 0.5`

On a 2x Retina display with a 300px cell, the threshold is 300px. A 320px EXIF thumb passes. A 160px EXIF thumb triggers HQ fetch.

The 0.5 factor means we only re-fetch when the image is being stretched to 2x or more — JPEG artifacts become visible around that point.

### Backend: `get_thumbnail_hq` command

- New Tauri command: `get_thumbnail_hq(path: String, width: u32) -> Result<String, String>`
- Always loads full image via `image::open()`, applies EXIF orientation, resizes to `width` px (aspect ratio preserved)
- For videos: same ffmpeg frame extraction as existing `get_thumbnail`, but resizes to `width` instead of 400px
- Returns base64 JPEG
- Separate in-memory cache keyed by `"{path}_hq_{width}"` so different requested widths don't evict each other
- The `width` parameter is what the frontend passes — `cellWidth * devicePixelRatio`, capped at 800px max (no point going higher than that for grid thumbnails)

### Frontend: Thumbnail component upgrade logic

- After first-pass `<img>` `onLoad`, read `img.naturalWidth`
- If `naturalWidth < cellWidth * window.devicePixelRatio * 0.5`, queue an HQ request
- `targetWidth = Math.min(Math.ceil(cellWidth * window.devicePixelRatio), 800)`
- When HQ data arrives, swap `src` — image sharpens in place
- On `cellWidth` prop change (user zooms grid): re-evaluate threshold against current `naturalWidth`. If cell grew and thumb is now too small, trigger HQ fetch. No downgrade on zoom-out.

### HQ Thumbnail Queue

- Separate queue from first-pass thumbnails (so HQ fetches don't block initial loading)
- Lower concurrency: 2 concurrent HQ requests (vs 4 for first-pass)
- Same FIFO pattern as existing `thumbnailQueue.ts`

### Files to Change

- **`src-tauri/src/photos.rs`**: Add `get_thumbnail_hq` function with separate cache, full-image resize path
- **`src-tauri/src/lib.rs`**: Register `get_thumbnail_hq` command
- **`src/lib/commands.ts`**: Add `getThumbnailHq` invoke wrapper
- **`src/lib/thumbnailQueue.ts`**: Add HQ queue (separate from existing queue)
- **`src/components/Thumbnail.tsx`**: Add onLoad measurement, conditional HQ upgrade, re-evaluate on cellWidth change

### What doesn't change

- First-pass loading path (EXIF thumb → 400px → base64) stays identical
- Existing thumbnail queue unchanged
- Preview mode (loads full image via `convertFileSrc`) unaffected
- Grid, Toolbar, zoom mechanics untouched
- Burst filmstrip thumbnails (small enough that 400px is fine)

### Edge cases

- **Zoom in (fewer columns → bigger cells):** Thumbnails re-evaluate and may trigger HQ fetch
- **Zoom out (more columns → smaller cells):** No action — HQ thumb displays fine at smaller sizes
- **Scroll:** HQ requests only fire for mounted (visible) thumbnails due to virtualized grid
- **Unmount before HQ arrives:** Standard cleanup pattern — cancelled flag prevents stale setState
