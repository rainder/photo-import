import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSelection } from "./hooks/useSelection";
import { usePhotos } from "./hooks/usePhotos";
import { useSDCard } from "./hooks/useSDCard";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { Grid, type PhotoSection, type GridHandle } from "./components/Grid";
import { Preview } from "./components/Preview";
import { ActionBar } from "./components/ActionBar";
import {
  ImportDialog,
  type ImportStage,
  type ImportProgress,
} from "./components/ImportDialog";
import { ImportReview } from "./components/ImportReview";
import { importToPhotos, deleteFromCard, ejectVolume, type PhotoMeta } from "./lib/commands";
import { open } from "@tauri-apps/plugin-dialog";
import { LazyStore } from "@tauri-apps/plugin-store";
import "./App.css";

const store = new LazyStore("config.json");

type SortBy = "name-asc" | "name-desc" | "date-asc" | "date-desc";

export default function App() {
  const [autoDetect, setAutoDetect] = useState(true);
  const { volume, setManualVolume } = useSDCard(autoDetect);
  const { photos: rawPhotos, loading, removePhoto, removePhotos } = usePhotos(volume?.path ?? null);
  const selection = useSelection();
  const gridRef = useRef<GridHandle>(null);

  const [sortBy, setSortBy] = useState<SortBy>("date-desc");
  const [columnCount, setColumnCount] = useState(5);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [deleteAfterImport, setDeleteAfterImport] = useState(false);
  const [importStage, setImportStage] = useState<ImportStage | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [_importedPaths, setImportedPaths] = useState<Set<string>>(new Set());
  const [previewDeleteConfirm, setPreviewDeleteConfirm] = useState(false);
  const [previewDirection, setPreviewDirection] = useState<1 | -1>(1);

  useEffect(() => {
    store.get<boolean>("autoDetect").then((val) => {
      if (val !== null && val !== undefined) setAutoDetect(val);
    });
  }, []);

  useEffect(() => {
    if (focusedIndex >= 0 && previewIndex === null) {
      gridRef.current?.scrollToPhoto(focusedIndex);
    }
  }, [focusedIndex, previewIndex]);

  useEffect(() => {
    if (rawPhotos.length > 0) {
      setFocusedIndex(0);
    }
  }, [rawPhotos]);

  const toggleAutoDetect = useCallback(() => {
    setAutoDetect((prev) => {
      const next = !prev;
      store.set("autoDetect", next).then(() => store.save());
      return next;
    });
  }, []);

  const photos = useMemo(() => {
    const sorted = [...rawPhotos];
    switch (sortBy) {
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "date-asc":
        sorted.sort((a, b) => a.date.localeCompare(b.date));
        break;
      case "date-desc":
        sorted.sort((a, b) => b.date.localeCompare(a.date));
        break;
    }
    return sorted;
  }, [rawPhotos, sortBy]);

  const sections = useMemo((): PhotoSection[] => {
    if (sortBy.startsWith("name")) {
      // When sorting by name, group by first letter
      const groups = new Map<string, PhotoMeta[]>();
      for (const photo of photos) {
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
    for (const photo of photos) {
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
  }, [photos, sortBy]);

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (previewIndex !== null) return;
      const lastIndex = photos.length - 1;
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
          if (focusedIndex >= 0 && photos[focusedIndex]) {
            selection.toggle(photos[focusedIndex].path);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, lastIndex));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + columnCount, lastIndex));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - columnCount, 0));
          break;
      }
    },
    [focusedIndex, previewIndex, photos, columnCount, selection]
  );

  const handlePreviewNavigate = useCallback(
    (delta: number) => {
      setPreviewDirection(delta > 0 ? 1 : -1);
      setPreviewIndex((prev) => {
        if (prev === null) return null;
        const next = prev + delta;
        let resolved: number;
        if (next < 0) resolved = photos.length - 1;
        else if (next >= photos.length) resolved = 0;
        else resolved = next;
        setFocusedIndex(resolved);
        return resolved;
      });
    },
    [photos.length]
  );

  const handleImport = useCallback(() => {
    setImportStage("review");
  }, []);

  const handleReviewConfirm = useCallback(async (paths: string[]) => {
    setImportStage("importing");

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
      setImportStage("deleting");
      const deletedPaths = new Set(succeeded);
      await deleteFromCard(Array.from(deletedPaths));
      removePhotos(deletedPaths);
      selection.deselectAll();
      setImportStage("done");
    } else {
      selection.deselectAll();
      setImportStage("done");
    }
  }, [deleteAfterImport, removePhotos, selection]);

  const handleDeleteConfirm = useCallback(async () => {
    setImportStage("deleting");
    const deletedPaths = new Set(selection.selected);
    await deleteFromCard(Array.from(deletedPaths));
    removePhotos(deletedPaths);
    if (previewIndex !== null && photos[previewIndex] && deletedPaths.has(photos[previewIndex].path)) {
      setPreviewIndex(null);
    }
    selection.deselectAll();
    setImportStage("done");
  }, [selection, removePhotos, previewIndex, photos]);

  const handleDeleteSelected = useCallback(() => {
    setImportStage("confirm-delete");
  }, []);


  const handleImportCancel = useCallback(() => {
    setImportStage(null);
    setImportProgress(null);
  }, []);

  const doPreviewDelete = useCallback(() => {
    if (previewIndex === null) return;
    const photo = photos[previewIndex];
    if (!photo) return;
    deleteFromCard([photo.path]).then(() => {
      removePhoto(photo.path);
      selection.removeMany([photo.path]);
      const remaining = photos.length - 1;
      if (remaining === 0) {
        setPreviewIndex(null);
      } else if (previewDirection === 1) {
        // Moving forward: stay at same index (next photo slides in)
        // But clamp if we were at the end
        setPreviewIndex(Math.min(previewIndex, remaining - 1));
      } else {
        // Moving backward: go to previous, or stay if at start
        setPreviewIndex(Math.max(0, previewIndex - 1));
      }
    });
  }, [previewIndex, photos, previewDirection, removePhoto, selection]);

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
    <div className="app" onKeyDown={handleGridKeyDown} tabIndex={0}>
      <TopBar
        volumeName={volume?.name ?? null}
        photoCount={photos.length}
        autoDetect={autoDetect}
        onToggleAutoDetect={toggleAutoDetect}
        onEject={() => {
          if (volume) ejectVolume(volume.path);
        }}
        onBrowse={async () => {
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
        }}
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
          ref={gridRef}
          sections={sections}
          photos={photos}
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
        />
      )}

      <ActionBar
        selectedCount={selection.count}
        onImport={handleImport}
        onDeleteSelected={handleDeleteSelected}
        importing={importStage === "importing"}
      />

      {previewIndex !== null && (
        <Preview
          photos={photos}
          currentIndex={previewIndex}
          isSelected={selection.isSelected(photos[previewIndex]?.path)}
          onClose={() => {
            const idx = previewIndex;
            setPreviewIndex(null);
            if (idx !== null) {
              requestAnimationFrame(() => gridRef.current?.scrollToPhoto(idx));
            }
          }}
          onNavigate={handlePreviewNavigate}
          onToggleSelect={() => selection.toggle(photos[previewIndex]?.path)}
          onDelete={handlePreviewDelete}
          deleteConfirm={previewDeleteConfirm}
          onDeleteConfirm={handlePreviewDeleteConfirm}
          onDeleteCancel={handlePreviewDeleteCancel}
        />
      )}

      {importStage === "review" && (
        <ImportReview
          photos={photos.filter((p) => selection.isSelected(p.path))}
          deleteAfterImport={deleteAfterImport}
          onToggleDelete={() => setDeleteAfterImport((v) => !v)}
          onConfirm={handleReviewConfirm}
          onCancel={handleImportCancel}
        />
      )}

      {importStage && importStage !== "review" && (
        <ImportDialog
          stage={importStage}
          photoCount={selection.count}
          deleteAfterImport={deleteAfterImport}
          onConfirm={handleDeleteConfirm}
          onCancel={handleImportCancel}
          progress={importProgress}
        />
      )}
    </div>
  );
}
