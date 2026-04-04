import { useState, useCallback, useMemo, useEffect } from "react";
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
import { LazyStore } from "@tauri-apps/plugin-store";
import "./App.css";

const store = new LazyStore("config.json");

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
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importedPaths, setImportedPaths] = useState<Set<string>>(new Set());

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

  const photos = useMemo(() => {
    const sorted = [...rawPhotos];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => a.date.localeCompare(b.date));
    }
    return sorted;
  }, [rawPhotos, sortBy]);

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

  const handleImport = useCallback(() => {
    setImportStage("confirm");
  }, []);

  const handleImportConfirm = useCallback(async () => {
    const paths = Array.from(selection.selected);

    if (importStage === "confirm") {
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
        onToggleAutoDetect={toggleAutoDetect}
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
          onToggleSelect={() => selection.toggle(photos[previewIndex]?.path)}
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
