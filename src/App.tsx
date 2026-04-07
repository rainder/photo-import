import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSelection } from "./hooks/useSelection";
import { usePhotos } from "./hooks/usePhotos";
import { useSDCard } from "./hooks/useSDCard";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { Grid, type PhotoSection, type GridHandle, type BurstInfo } from "./components/Grid";
import { Preview, formatDuration } from "./components/Preview";
import { ActionBar } from "./components/ActionBar";
import {
  ImportDialog,
  type ImportStage,
  type ImportProgress,
} from "./components/ImportDialog";
import { ImportReview } from "./components/ImportReview";
import { GpxBar } from "./components/GpxBar";
import { MiniMap } from "./components/MiniMap";
import { FullMap } from "./components/FullMap";
import { TimelineStrip } from "./components/TimelineStrip";
import { ExposureHistogram } from "./components/ExposureHistogram";
import { detectGroups, type DetectionInfo } from "./lib/detectGroups";
import { importToPhotos, importWithGps, deleteFromCard, ejectVolume, evictThumbnail, clearThumbnailCache, checkFfmpeg, loadGpx, unloadGpx, unloadGpxFile, matchPhotosToGpx, getGpxTrack, syncMenuCheck, type PhotoMeta, type FfmpegStatus, type GpxSummary, type GpxMatch } from "./lib/commands";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { LazyStore } from "@tauri-apps/plugin-store";
import "./App.css";

const store = new LazyStore("config.json");

type SortBy = "name-asc" | "name-desc" | "date-asc" | "date-desc";

export default function App() {
  const [autoDetect, setAutoDetect] = useState(true);
  const { volume, setManualVolume } = useSDCard(autoDetect);
  const { photos: rawPhotos, loading, removePhoto, removePhotos, reload } = usePhotos(volume?.path ?? null);
  const selection = useSelection();
  const gridRef = useRef<GridHandle>(null);

  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  const [columnCount, setColumnCountRaw] = useState(5);
  const setColumnCount = useCallback((val: number | ((prev: number) => number)) => {
    setColumnCountRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      store.set("columnCount", next).then(() => store.save());
      return next;
    });
  }, []);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleteAfterImport, setDeleteAfterImport] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [_importedPaths, setImportedPaths] = useState<Set<string>>(new Set());
  const [previewDeleteConfirm, setPreviewDeleteConfirm] = useState(false);
  const [gridDeleteIndex, setGridDeleteIndex] = useState<number | null>(null);
  const [previewDirection, setPreviewDirection] = useState<1 | -1>(1);
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
  const [ffmpegDismissed, setFfmpegDismissed] = useState(false);
  const [showGridInfo, setShowGridInfo] = useState(false);
  const [gpxSummaries, setGpxSummaries] = useState<GpxSummary[]>([]);
  const [gpxMatches, setGpxMatches] = useState<Record<string, GpxMatch>>({});
  const [gpxTrack, setGpxTrack] = useState<[number, number][]>([]);
  const [gpxLoading, setGpxLoading] = useState(false);
  const [gpxDragOver, setGpxDragOver] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [groupBursts, setGroupBursts] = useState(true);
  const [burstViewIndex, setBurstViewIndex] = useState(0);
  const [burstFocused, setBurstFocused] = useState(false);

  useEffect(() => {
    store.get<boolean>("autoDetect").then((val) => {
      if (val !== null && val !== undefined) {
        setAutoDetect(val);
        syncMenuCheck("auto_detect", val);
      }
    });
    store.get<number>("columnCount").then((val) => {
      if (val !== null && val !== undefined) setColumnCount(val);
    });
    store.get<boolean>("groupBursts").then((val) => {
      if (val !== null && val !== undefined) {
        setGroupBursts(val);
        syncMenuCheck("group_bursts", val);
      }
    });
    store.get<boolean>("showTimeline").then((val) => {
      if (val !== null && val !== undefined) {
        setShowTimeline(val);
        syncMenuCheck("toggle_timeline", val);
      }
    });
    store.get<boolean>("showGridInfo").then((val) => {
      if (val !== null && val !== undefined) {
        setShowGridInfo(val);
        syncMenuCheck("toggle_info", val);
      }
    });
    checkFfmpeg().then(setFfmpegStatus);
  }, []);

  useEffect(() => {
    if (focusedIndex >= 0 && previewIndex === null) {
      gridRef.current?.scrollToPhoto(focusedIndex);
    }
  }, [focusedIndex, previewIndex]);

  // Reset burst view when preview changes
  useEffect(() => {
    setBurstViewIndex(0);
  }, [previewIndex]);

  const prevVolumeRef = useRef(volume?.path);
  useEffect(() => {
    if (volume?.path !== prevVolumeRef.current) {
      prevVolumeRef.current = volume?.path;
      if (rawPhotos.length > 0) {
        setFocusedIndex(0);
      }
    }
  }, [rawPhotos, volume?.path]);

  const handleReload = useCallback(() => {
    clearThumbnailCache();
    reload();
  }, [reload]);

  const toggleAutoDetect = useCallback(() => {
    setAutoDetect((prev) => {
      const next = !prev;
      store.set("autoDetect", next).then(() => store.save());
      return next;
    });
  }, []);

  const handleBrowseFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select folder with photos",
    });
    if (selected) {
      const path = typeof selected === "string" ? selected : selected;
      const name = path.split("/").pop() ?? path;
      setManualVolume({ name, path });
    }
  }, [setManualVolume]);

  const handleGpxLoad = useCallback(async (path: string) => {
    setGpxLoading(true);
    try {
      const summary = await loadGpx(path);
      setGpxSummaries((prev) => {
        const filtered = prev.filter((s) => s.filename !== summary.filename);
        return [...filtered, summary];
      });
      const track = await getGpxTrack();
      setGpxTrack(track);
      // Auto-match photos against all loaded GPX files
      const photosWithDates: [string, string][] = rawPhotos
        .filter((p) => p.date && !p.latitude)
        .map((p) => [p.path, p.date]);
      if (photosWithDates.length > 0) {
        const matches = await matchPhotosToGpx(photosWithDates, 0, 600);
        setGpxMatches(matches);
      }
    } catch (err) {
      console.error("Failed to load GPX:", err);
    } finally {
      setGpxLoading(false);
    }
  }, [rawPhotos]);

  const handleGpxUnloadFile = useCallback(async (filename: string) => {
    await unloadGpxFile(filename);
    setGpxSummaries((prev) => prev.filter((s) => s.filename !== filename));
    const track = await getGpxTrack();
    setGpxTrack(track);
    // Re-match with remaining files
    const photosWithDates: [string, string][] = rawPhotos
      .filter((p) => p.date && !p.latitude)
      .map((p) => [p.path, p.date]);
    if (photosWithDates.length > 0 && track.length > 0) {
      const matches = await matchPhotosToGpx(photosWithDates, 0, 600);
      setGpxMatches(matches);
    } else {
      setGpxMatches({});
    }
  }, [rawPhotos]);

  const handleGpxUnloadAll = useCallback(() => {
    unloadGpx();
    setGpxSummaries([]);
    setGpxMatches({});
    setGpxTrack([]);
  }, []);

  const handleGpxBrowse = useCallback(async () => {
    const selected = await open({
      multiple: false,
      title: "Select GPX file",
      filters: [{ name: "GPX files", extensions: ["gpx"] }],
    });
    if (selected) {
      const path = typeof selected === "string" ? selected : selected;
      await handleGpxLoad(path);
    }
  }, [handleGpxLoad]);

  const handleGpxDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setGpxDragOver(true);
  }, []);

  const handleGpxDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set false if leaving the window (not entering a child)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setGpxDragOver(false);
    }
  }, []);

  const handleGpxDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setGpxDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith(".gpx")) {
          const path = (file as unknown as { path?: string }).path ?? file.name;
          handleGpxLoad(path);
        }
      }
    },
    [handleGpxLoad]
  );

  // Menu event handler
  const menuHandlers = useRef<Record<string, () => void>>({});
  menuHandlers.current = {
    browse_folder: handleBrowseFolder,
    load_gpx: handleGpxBrowse,
    reload: handleReload,
    import: () => { if (selection.count > 0) setImportStage("review"); },
    eject: () => { if (volume) ejectVolume(volume.path); },
    select_all_photos: () => selection.selectAll(displayPhotos.map((p) => p.path)),
    deselect_all: selection.deselectAll,
    toggle_info: () => {
      if (previewIndex !== null) return;
      setShowGridInfo((v) => {
        store.set("showGridInfo", !v).then(() => store.save());
        return !v;
      });
    },
    auto_detect: toggleAutoDetect,
    toggle_map: () => setShowMap((v) => !v),  // CheckMenuItem auto-toggles
    toggle_timeline: () => setShowTimeline((v) => {
      store.set("showTimeline", !v).then(() => store.save());
      return !v;
    }),
    group_bursts: () => {
      setGroupBursts((prev) => {
        const next = !prev;
        store.set("groupBursts", next).then(() => store.save());
        return next;
      });
    },
    zoom_in: () => setColumnCount((prev) => Math.max(prev - 1, 3)),
    zoom_out: () => setColumnCount((prev) => Math.min(prev + 1, 8)),
    delete_focused: () => {
      if (focusedIndex >= 0 && displayPhotos[focusedIndex]) {
        setGridDeleteIndex(focusedIndex);
      }
    },
    delete_selected: () => {
      if (selection.count > 0) setImportStage("confirm-delete");
    },
  };

  useEffect(() => {
    const unlisten = listen<string>("menu-event", (event) => {
      const handler = menuHandlers.current[event.payload];
      if (handler) handler();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const [mediaFilter, setMediaFilter] = useState<"all" | "photo" | "video">("all");
  const [cameraFilter, setCameraFilter] = useState<string>("all");

  const photoCount = useMemo(() => rawPhotos.filter((p) => p.media_type === "photo").length, [rawPhotos]);
  const videoCount = useMemo(() => rawPhotos.filter((p) => p.media_type === "video").length, [rawPhotos]);

  const stats = useMemo(() => {
    const cameras = new Set<string>();
    let totalSize = 0;
    for (const p of rawPhotos) {
      totalSize += p.size;
      if (p.camera) cameras.add(p.camera);
    }
    return { cameras: Array.from(cameras), totalSize };
  }, [rawPhotos]);

  const photos = useMemo(() => {
    let filtered = [...rawPhotos];
    if (mediaFilter !== "all") filtered = filtered.filter((p) => p.media_type === mediaFilter);
    if (cameraFilter !== "all") filtered = filtered.filter((p) => p.camera === cameraFilter);
    switch (sortBy) {
      case "name-asc":
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "date-asc":
        filtered.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "date-desc":
        filtered.sort((a, b) => b.date.localeCompare(a.date));
        break;
    }
    return filtered;
  }, [rawPhotos, sortBy, mediaFilter, cameraFilter]);

  // Burst detection: consecutive photos within 2 seconds
  const burstMap = useMemo(() => {
    const map = new Map<string, { burstId: number; burstCount: number; burstIndex: number }>();
    if (photos.length < 2) return map;

    let burstId = 0;
    let burstStart = 0;

    for (let i = 1; i <= photos.length; i++) {
      const prev = photos[i - 1];
      const curr = i < photos.length ? photos[i] : null;

      const prevTime = new Date(prev.date).getTime();
      const currTime = curr ? new Date(curr.date).getTime() : Infinity;
      const gap = Math.abs(currTime - prevTime);

      // If gap > 2s or different media type, close the current burst
      if (gap > 2000 || !curr || curr.media_type !== prev.media_type) {
        const burstLen = i - burstStart;
        if (burstLen >= 2) {
          for (let j = burstStart; j < i; j++) {
            map.set(photos[j].path, {
              burstId,
              burstCount: burstLen,
              burstIndex: j - burstStart,
            });
          }
          burstId++;
        }
        burstStart = i;
      }
    }
    return map;
  }, [photos]);

  // When grouping bursts, filter to only show cover photos
  const displayPhotos = useMemo(() => {
    if (!groupBursts) return photos;
    return photos.filter((p) => {
      const burst = burstMap.get(p.path);
      return !burst || burst.burstIndex === 0;
    });
  }, [photos, burstMap, groupBursts]);

  // Lookup: for each displayPhotos index, find burst members in full photos array
  const burstLookup = useMemo(() => {
    const displayToBurstMembers = new Map<number, PhotoMeta[]>();
    if (!groupBursts) return { displayToBurstMembers };

    let displayIdx = 0;
    for (let i = 0; i < photos.length; i++) {
      const burst = burstMap.get(photos[i].path);
      if (burst && burst.burstIndex > 0) continue;

      if (burst && burst.burstIndex === 0) {
        const members: PhotoMeta[] = [];
        for (let j = i; j < photos.length; j++) {
          const b = burstMap.get(photos[j].path);
          if (b && b.burstId === burst.burstId) {
            members.push(photos[j]);
          } else break;
        }
        if (members.length > 1) {
          displayToBurstMembers.set(displayIdx, members);
        }
      }
      displayIdx++;
    }

    return { displayToBurstMembers };
  }, [photos, burstMap, groupBursts]);

  // Clamp focused index when display list shrinks (e.g. toggling burst grouping)
  useEffect(() => {
    if (focusedIndex >= displayPhotos.length && displayPhotos.length > 0) {
      setFocusedIndex(displayPhotos.length - 1);
    }
  }, [displayPhotos.length, focusedIndex]);

  // RAW+JPG pair detection: match by filename stem
  const rawPairMap = useMemo(() => {
    const RAW_EXTS = new Set(["cr2", "cr3", "nef", "arw", "raf", "dng", "orf", "rw2", "pef", "srw"]);
    const JPG_EXTS = new Set(["jpg", "jpeg"]);

    const byStem = new Map<string, { raws: string[]; jpgs: string[] }>();
    for (const p of photos) {
      if (p.media_type !== "photo") continue;
      const dot = p.name.lastIndexOf(".");
      if (dot < 0) continue;
      const stem = p.name.substring(0, dot).toLowerCase();
      const ext = p.name.substring(dot + 1).toLowerCase();
      let entry = byStem.get(stem);
      if (!entry) {
        entry = { raws: [], jpgs: [] };
        byStem.set(stem, entry);
      }
      if (RAW_EXTS.has(ext)) entry.raws.push(p.path);
      else if (JPG_EXTS.has(ext)) entry.jpgs.push(p.path);
    }

    // Map path -> paired path
    const pairs = new Map<string, string>();
    for (const { raws, jpgs } of byStem.values()) {
      if (raws.length > 0 && jpgs.length > 0) {
        for (const r of raws) pairs.set(r, jpgs[0]);
        for (const j of jpgs) pairs.set(j, raws[0]);
      }
    }
    return pairs;
  }, [photos]);

  // Smart detection: duplicates, time-lapse, panorama
  const detectionMap = useMemo(() => detectGroups(photos), [photos]);

  // For burst covers: how many burst members are selected (excluding cover itself)
  const burstSelectedMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!groupBursts) return map;
    for (const [displayIdx, members] of burstLookup.displayToBurstMembers) {
      const cover = displayPhotos[displayIdx];
      if (!cover) continue;
      const count = members.filter((m) => selection.isSelected(m.path)).length;
      if (count > 0) map.set(cover.path, count);
    }
    return map;
  }, [groupBursts, burstLookup, displayPhotos, selection]);

  const sections = useMemo((): PhotoSection[] => {
    if (sortBy.startsWith("name")) {
      // When sorting by name, group by first letter
      const groups = new Map<string, PhotoMeta[]>();
      for (const photo of displayPhotos) {
        const letter = photo.name[0]?.toUpperCase() ?? "#";
        let group = groups.get(letter);
        if (!group) {
          group = [];
          groups.set(letter, group);
        }
        group.push(photo);
      }
      return Array.from(groups, ([letter, items]) => ({
        label: letter,
        photos: items,
      }));
    }

    // When sorting by date, group by calendar date
    const groups = new Map<string, PhotoMeta[]>();
    for (const photo of displayPhotos) {
      const dateKey = photo.date ? new Date(photo.date).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) : "Unknown Date";
      let group = groups.get(dateKey);
      if (!group) {
        group = [];
        groups.set(dateKey, group);
      }
      group.push(photo);
    }
    return Array.from(groups, ([date, items]) => ({
      label: date,
      photos: items,
    }));
  }, [displayPhotos, sortBy]);

  // Build grid position map for section-aware navigation
  const gridNav = useMemo(() => {
    // For each flat index, store { section index, offset within section }
    const positions: { section: number; offset: number }[] = [];
    let flatIdx = 0;
    const sectionStarts: number[] = [];
    const sectionLengths: number[] = [];
    for (let s = 0; s < sections.length; s++) {
      sectionStarts.push(flatIdx);
      sectionLengths.push(sections[s].photos.length);
      for (let i = 0; i < sections[s].photos.length; i++) {
        positions.push({ section: s, offset: i });
      }
      flatIdx += sections[s].photos.length;
    }

    function moveVertical(fromIndex: number, direction: 1 | -1): number {
      if (fromIndex < 0 || fromIndex >= positions.length) return fromIndex;
      const pos = positions[fromIndex];
      const col = pos.offset % columnCount;
      const row = Math.floor(pos.offset / columnCount);
      const newRow = row + direction;

      if (direction === 1) {
        // Down: try same column in next row of same section
        const newOffset = newRow * columnCount + col;
        const sLen = sectionLengths[pos.section];
        if (newOffset < sLen) {
          return sectionStarts[pos.section] + newOffset;
        }
        // Jump to next section, first photo (column 0)
        const nextSection = pos.section + 1;
        if (nextSection < sections.length) {
          return sectionStarts[nextSection];
        }
        // Already at last section, clamp to last photo
        return positions.length - 1;
      } else {
        // Up: try same column in previous row of same section
        if (newRow >= 0) {
          const newOffset = newRow * columnCount + col;
          return sectionStarts[pos.section] + newOffset;
        }
        // Jump to previous section, last row, same column
        const prevSection = pos.section - 1;
        if (prevSection >= 0) {
          const prevLen = sectionLengths[prevSection];
          const lastRow = Math.floor((prevLen - 1) / columnCount);
          const newOffset = lastRow * columnCount + col;
          return sectionStarts[prevSection] + Math.min(newOffset, prevLen - 1);
        }
        return 0;
      }
    }

    return { moveVertical };
  }, [sections, columnCount]);

  const confirmGridDelete = useCallback(() => {
    if (gridDeleteIndex === null) return;
    const photo = displayPhotos[gridDeleteIndex];
    if (!photo) return;
    const remaining = displayPhotos.length - 1;
    deleteFromCard([photo.path]).then(() => {
      evictThumbnail(photo.path);
      removePhoto(photo.path);
      selection.removeMany([photo.path]);
    });
    setGridDeleteIndex(null);
    setFocusedIndex(remaining > 0 ? Math.min(gridDeleteIndex, remaining - 1) : -1);
  }, [gridDeleteIndex, displayPhotos, removePhoto, selection]);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (previewIndex !== null || importStage !== null) return;

      if (gridDeleteIndex !== null) {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmGridDelete();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setGridDeleteIndex(null);
        }
        return;
      }

      if (e.metaKey && e.key === "i") {
        e.preventDefault();
        setShowGridInfo((v) => {
          const next = !v;
          store.set("showGridInfo", next).then(() => store.save());
          syncMenuCheck("toggle_info", next);
          return next;
        });
        return;
      }

      const lastIndex = displayPhotos.length - 1;
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (e.metaKey && selection.count > 0) {
            setImportStage("review");
          } else if (focusedIndex >= 0) {
            setPreviewIndex(focusedIndex);
          }
          break;
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && displayPhotos[focusedIndex]) {
            selection.toggle(displayPhotos[focusedIndex].path);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex((prev) => prev < 0 ? 0 : Math.min(prev + 1, lastIndex));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex((prev) => prev < 0 ? 0 : Math.max(prev - 1, 0));
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => prev < 0 ? 0 : gridNav.moveVertical(prev, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => prev < 0 ? 0 : gridNav.moveVertical(prev, -1));
          break;
        case "=":
        case "+":
          if (e.metaKey) {
            e.preventDefault();
            setColumnCount((prev) => Math.max(prev - 1, 3));
          }
          break;
        case "-":
          if (e.metaKey) {
            e.preventDefault();
            setColumnCount((prev) => Math.min(prev + 1, 8));
          }
          break;
        case "Backspace":
          if (e.metaKey && focusedIndex >= 0 && displayPhotos[focusedIndex]) {
            e.preventDefault();
            setGridDeleteIndex(focusedIndex);
          }
          break;
        case "r":
          if (e.metaKey) {
            e.preventDefault();
            handleReload();
          }
          break;
        case "a":
          if (e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              selection.deselectAll();
            } else {
              selection.selectAll(displayPhotos.map((p) => p.path));
            }
          }
          break;
      }
    },
    [focusedIndex, previewIndex, importStage, gridDeleteIndex, confirmGridDelete, displayPhotos, columnCount, selection, handleReload, gridNav]
  );

  const handlePreviewNavigate = useCallback(
    (delta: number) => {
      if (previewIndex === null) return;

      if (groupBursts && burstFocused) {
        const members = burstLookup.displayToBurstMembers.get(previewIndex);
        if (members && members.length > 1) {
          const newIdx = burstViewIndex + delta;
          if (newIdx >= 0 && newIdx < members.length) {
            setBurstViewIndex(newIdx);
            return;
          }
          // At edge of burst — exit burst and move to adjacent display photo
          setBurstFocused(false);
        }
      }

      // Move to next/prev display photo
      setPreviewDirection(delta > 0 ? 1 : -1);
      setBurstViewIndex(0);
      setBurstFocused(false);
      setPreviewIndex((prev) => {
        if (prev === null) return null;
        const next = prev + delta;
        let resolved: number;
        if (next < 0) resolved = 0;
        else if (next >= displayPhotos.length) resolved = displayPhotos.length - 1;
        else resolved = next;
        setFocusedIndex(resolved);
        return resolved;
      });
    },
    [displayPhotos.length, previewIndex, groupBursts, burstFocused, burstViewIndex, burstLookup]
  );

  const handleBurstEnter = useCallback(() => {
    if (previewIndex === null || !groupBursts) return;
    const members = burstLookup.displayToBurstMembers.get(previewIndex);
    if (members && members.length > 1) {
      setBurstFocused(true);
    }
  }, [previewIndex, groupBursts, burstLookup]);

  const handleBurstExit = useCallback(() => {
    setBurstFocused(false);
  }, []);

  const handleImport = useCallback(() => {
    setImportStage("review");
  }, []);

  const handleReviewConfirm = useCallback(async (paths: string[]) => {
    setImportStage("importing");

    const hasGpxMatches = Object.keys(gpxMatches).length > 0;
    const succeeded: string[] = [];
    for (let i = 0; i < paths.length; i++) {
      setImportProgress({
        current: i + 1,
        total: paths.length,
        currentFile: paths[i].split("/").pop() ?? paths[i],
      });

      let result;
      const match = gpxMatches[paths[i]];
      if (hasGpxMatches && match) {
        result = await importWithGps([{ path: paths[i], lat: match.lat, lon: match.lon }]);
      } else {
        result = await importToPhotos([paths[i]]);
      }
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
      setImportStage("deleting");
      const deletedPaths = new Set(succeeded);
      await deleteFromCard(Array.from(deletedPaths));
      for (const p of deletedPaths) evictThumbnail(p);
      removePhotos(deletedPaths);
      selection.deselectAll();
      setImportStage("done");
    } else {
      selection.deselectAll();
      setImportStage("done");
    }
  }, [deleteAfterImport, removePhotos, selection, gpxMatches]);

  const handleDeleteConfirm = useCallback(async () => {
    setImportStage("deleting");
    const deletedPaths = new Set(selection.selected);
    await deleteFromCard(Array.from(deletedPaths));
    for (const p of deletedPaths) evictThumbnail(p);
    removePhotos(deletedPaths);
    if (previewIndex !== null && displayPhotos[previewIndex] && deletedPaths.has(displayPhotos[previewIndex].path)) {
      setPreviewIndex(null);
    }
    selection.deselectAll();
    setImportStage(null);
  }, [selection, removePhotos, previewIndex, photos]);



  const handleImportCancel = useCallback(() => {
    setImportStage(null);
    setImportProgress(null);
  }, []);

  const handleReviewCancel = useCallback((deselected: string[]) => {
    if (deselected.length > 0) {
      selection.removeMany(deselected);
    }
    setImportStage(null);
  }, [selection]);

  const doPreviewDelete = useCallback(() => {
    if (previewIndex === null) return;
    const photo = displayPhotos[previewIndex];
    if (!photo) return;
    deleteFromCard([photo.path]).then(() => {
      evictThumbnail(photo.path);
      removePhoto(photo.path);
      selection.removeMany([photo.path]);
      const remaining = displayPhotos.length - 1;
      if (remaining === 0) {
        setPreviewIndex(null);
      } else if (previewDirection === 1) {
        setPreviewIndex(Math.min(previewIndex, remaining - 1));
      } else {
        setPreviewIndex(Math.max(0, previewIndex - 1));
      }
    });
  }, [previewIndex, displayPhotos, previewDirection, removePhoto, selection]);

  const handlePreviewDelete = useCallback((skipConfirm: boolean) => {
    if (skipConfirm) {
      doPreviewDelete();
    } else {
      setPreviewDeleteConfirm(true);
    }
  }, [doPreviewDelete]);

  const handlePreviewDeleteConfirm = useCallback(() => {
    setPreviewDeleteConfirm(false);
    doPreviewDelete();
  }, [doPreviewDelete]);

  const handlePreviewDeleteCancel = useCallback(() => {
    setPreviewDeleteConfirm(false);
  }, []);

  return (
    <div
      className={`app ${gpxDragOver ? "gpx-drag-over" : ""}`}
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
      onDragOver={handleGpxDragOver}
      onDragLeave={handleGpxDragLeave}
      onDrop={handleGpxDrop}
    >
      <TopBar
        volumeName={volume?.name ?? null}
        photoCount={displayPhotos.length}
      />
      {ffmpegStatus && (!ffmpegStatus.ffmpeg || !ffmpegStatus.ffprobe) && !ffmpegDismissed && (
        <div className="ffmpeg-banner">
          <div className="ffmpeg-banner-content">
            <span>
              <strong>{!ffmpegStatus.ffmpeg && !ffmpegStatus.ffprobe ? "ffmpeg & ffprobe" : !ffmpegStatus.ffmpeg ? "ffmpeg" : "ffprobe"}</strong> not found. Video thumbnails and metadata won't work.
            </span>
            <span className="ffmpeg-banner-install">
              Install via Homebrew: <code>brew install ffmpeg</code>
            </span>
          </div>
          <button className="ffmpeg-banner-dismiss" onClick={() => setFfmpegDismissed(true)}>✕</button>
        </div>
      )}
      <Toolbar
        selectedCount={selection.count}
        totalCount={displayPhotos.length}
        sortBy={sortBy}
        onSortChange={setSortBy}
        columnCount={columnCount}
        onColumnCountChange={setColumnCount}
        mediaFilter={mediaFilter}
        onMediaFilterChange={setMediaFilter}
        photoCount={photoCount}
        videoCount={videoCount}
      />

      <GpxBar
        summaries={gpxSummaries}
        matchCount={Object.keys(gpxMatches).length}
        loading={gpxLoading}
        onUnloadFile={handleGpxUnloadFile}
        onUnloadAll={handleGpxUnloadAll}
      />
      <div className="grid-and-info">
        {loading ? (
          <div className="grid-empty">
            <p>Loading photos...</p>
          </div>
        ) : showMap ? (
          <FullMap
            photos={displayPhotos}
            gpxMatches={gpxMatches}
            gpxTrack={gpxTrack}
            focusedIndex={focusedIndex}
            onFocus={setFocusedIndex}
            onPreview={setPreviewIndex}
          />
        ) : (
          <Grid
            ref={gridRef}
            sections={sections}
            photos={displayPhotos}
            isSelected={selection.isSelected}
            focusedIndex={focusedIndex}
            onSelect={selection.toggle}
            onFocus={setFocusedIndex}
            onPreview={setPreviewIndex}
            onSelectSection={(paths, allSelected) => {
              if (allSelected) {
                selection.removeMany(paths);
              } else {
                selection.addMany(paths);
              }
            }}
            columnCount={columnCount}
            burstMap={burstMap}
            rawPairMap={rawPairMap}
            detectionMap={detectionMap}
            groupBursts={groupBursts}
            burstSelectedMap={burstSelectedMap}
          />
        )}
        {
          <GridInfoPanel
            open={showGridInfo}
            photo={focusedIndex >= 0 ? displayPhotos[focusedIndex] : null}
            burstInfo={focusedIndex >= 0 && displayPhotos[focusedIndex] ? burstMap.get(displayPhotos[focusedIndex].path) : undefined}
            rawPair={focusedIndex >= 0 && displayPhotos[focusedIndex] ? rawPairMap.get(displayPhotos[focusedIndex].path) : undefined}
            gpxMatch={focusedIndex >= 0 && displayPhotos[focusedIndex] ? gpxMatches[displayPhotos[focusedIndex].path] : undefined}
            gpxTrack={gpxTrack}
            detection={focusedIndex >= 0 && displayPhotos[focusedIndex] ? detectionMap.get(displayPhotos[focusedIndex].path) : undefined}
            allPhotos={rawPhotos}
            onClose={() => { setShowGridInfo(false); store.set("showGridInfo", false).then(() => store.save()); syncMenuCheck("toggle_info", false); }}
          />
        }
      </div>

      {showTimeline && displayPhotos.length > 1 && (
        <TimelineStrip
          photos={displayPhotos}
          focusedIndex={focusedIndex}
          onFocus={setFocusedIndex}
        />
      )}

      {rawPhotos.length > 0 && (
        <div className="stats-bar">
          <span>{photoCount} photos · {videoCount} videos · {stats.cameras.length} camera{stats.cameras.length !== 1 ? "s" : ""} · {formatSize(stats.totalSize)}</span>
          {stats.cameras.length > 1 && (
            <select
              className="toolbar-select"
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
            >
              <option value="all">All cameras</option>
              {stats.cameras.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      )}
      <ActionBar
        selectedCount={selection.count}
        onImport={handleImport}
        importing={importStage === "importing"}
      />

      {previewIndex !== null && (() => {
        const members = groupBursts ? burstLookup.displayToBurstMembers.get(previewIndex) : undefined;
        const currentPhoto = members && burstViewIndex < members.length
          ? members[burstViewIndex]
          : displayPhotos[previewIndex];
        return currentPhoto ? (
          <Preview
            photos={displayPhotos}
            currentIndex={previewIndex}
            currentPhoto={currentPhoto}
            isSelected={selection.isSelected(currentPhoto.path)}
            onClose={() => {
              const idx = previewIndex;
              setPreviewIndex(null);
              if (idx !== null) {
                requestAnimationFrame(() => gridRef.current?.scrollToPhoto(idx));
              }
            }}
            onNavigate={handlePreviewNavigate}
            onToggleSelect={() => selection.toggle(currentPhoto.path)}
            onDelete={handlePreviewDelete}
            deleteConfirm={previewDeleteConfirm}
            onDeleteConfirm={handlePreviewDeleteConfirm}
            onDeleteCancel={handlePreviewDeleteCancel}
            gpxMatch={gpxMatches[currentPhoto.path]}
            gpxTrack={gpxTrack}
            burstMembers={members}
            burstViewIndex={burstViewIndex}
            onBurstNavigate={(index: number) => {
              setBurstViewIndex(index);
              setBurstFocused(true);
            }}
            burstFocused={burstFocused}
            onBurstEnter={handleBurstEnter}
            onBurstExit={handleBurstExit}
            isPathSelected={selection.isSelected}
          />
        ) : null;
      })()}

      {gridDeleteIndex !== null && displayPhotos[gridDeleteIndex] && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Delete "{displayPhotos[gridDeleteIndex].name}" from SD card?</h3>
            <p className="dialog-warning">This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={() => setGridDeleteIndex(null)}>Cancel</button>
              <button className="dialog-btn danger" onClick={confirmGridDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {importStage === "review" && (
        <ImportReview
          photos={photos.filter((p) => selection.isSelected(p.path))}
          deleteAfterImport={deleteAfterImport}
          onToggleDelete={() => setDeleteAfterImport((v) => !v)}
          onConfirm={handleReviewConfirm}
          onCancel={handleReviewCancel}
          initialColumnCount={columnCount}
          onColumnCountChange={setColumnCount}
        />
      )}

      {importStage && importStage !== "review" && (
        <ImportDialog
          stage={importStage}
          photoCount={selection.count}
          onConfirm={handleDeleteConfirm}
          onCancel={handleImportCancel}
          progress={importProgress}
        />
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GridInfoPanel({
  open,
  photo,
  burstInfo,
  rawPair,
  gpxMatch,
  gpxTrack,
  detection,
  allPhotos,
  onClose,
}: {
  open: boolean;
  photo: PhotoMeta | null;
  burstInfo?: BurstInfo;
  rawPair?: string;
  gpxMatch?: GpxMatch;
  gpxTrack: [number, number][];
  detection?: DetectionInfo;
  allPhotos: PhotoMeta[];
  onClose: () => void;
}) {
  type Row = [string, string | undefined | null];
  const rows: Row[] = [];

  // Determine location: prefer embedded GPS, fall back to GPX match
  const lat = photo?.latitude ?? gpxMatch?.lat;
  const lon = photo?.longitude ?? gpxMatch?.lon;
  const locationSource = photo?.latitude != null ? "exif" : gpxMatch ? "gpx" : null;

  if (photo) {
    rows.push(["File", photo.name]);
    rows.push(["Size", formatSize(photo.size)]);
    rows.push(["Date", photo.date ? new Date(photo.date).toLocaleString() : undefined]);
    rows.push(["Dimensions", photo.width && photo.height ? `${photo.width} × ${photo.height}` : undefined]);
    if (photo.media_type === "photo") {
      rows.push(["Camera", photo.camera], ["Lens", photo.lens], ["Focal Length", photo.focal_length]);
      rows.push(["Aperture", photo.aperture], ["Shutter", photo.shutter_speed], ["ISO", photo.iso]);
    }
    if (photo.media_type === "video") {
      rows.push(["Duration", photo.duration ? formatDuration(photo.duration) : undefined]);
      rows.push(["Resolution", photo.resolution], ["Frame Rate", photo.fps], ["Codec", photo.codec]);
    }
    if (lat != null && lon != null) {
      const suffix = locationSource === "gpx" ? " (GPX)" : "";
      rows.push(["GPS", `${lat.toFixed(5)}, ${lon.toFixed(5)}${suffix}`]);
    }
    if (photo.rating) {
      rows.push(["Rating", "★".repeat(photo.rating) + "☆".repeat(5 - photo.rating)]);
    }
    if (burstInfo) {
      rows.push(["Burst", `${burstInfo.burstIndex + 1} of ${burstInfo.burstCount}`]);
    }
    if (rawPair) {
      rows.push(["RAW Pair", rawPair.split("/").pop() ?? rawPair]);
    }
    if (detection) {
      rows.push(["Detected", detection.label]);
    }
    rows.push(["Path", photo.path]);
  }

  return (
    <div className={`grid-info-panel ${open ? "open" : ""}`}>
      <div className="grid-info-panel-header">
        <span>Info</span>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="grid-info-panel-body">
        {!photo ? (
          <p className="grid-info-empty">No photo selected</p>
        ) : (
          <>
            {lat != null && lon != null && (
              <div className="grid-info-map">
                <MiniMap lat={lat} lon={lon} gpxTrack={gpxTrack} />
              </div>
            )}
            {rows.map(([label, value]) =>
              value ? (
                <div key={label} className="grid-info-row">
                  <span className="grid-info-label">{label}</span>
                  <span className="grid-info-value">{value}</span>
                </div>
              ) : null
            )}
            <ExposureHistogram photos={allPhotos} />
          </>
        )}
      </div>
    </div>
  );
}
