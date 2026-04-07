import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { List, useListRef } from "react-window";
import type { PhotoMeta } from "../lib/commands";
import { Thumbnail } from "./Thumbnail";
import { Preview } from "./Preview";

interface ImportReviewProps {
  photos: PhotoMeta[];
  deleteAfterImport: boolean;
  onToggleDelete: () => void;
  onConfirm: (paths: string[]) => void;
  onCancel: (deselected: string[]) => void;
  initialColumnCount: number;
  onColumnCountChange: (count: number) => void;
}

interface RowExtraProps {
  photoRows: (PhotoMeta | null)[][];
  cellWidth: number;
  selected: Set<string>;
  focusedIndex: number;
  onToggle: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
}

function RowRenderer(props: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: object;
} & RowExtraProps) {
  const { index, style, photoRows, cellWidth, selected, focusedIndex, onToggle, onFocus, onPreview } = props;
  const items = photoRows[index];

  return (
    <div style={{ ...style, display: "flex" }}>
      {items.map((photo, colIdx) => {
        if (!photo) return <div key={colIdx} style={{ width: cellWidth }} />;
        const flatIdx = index * photoRows[0].length + colIdx;
        return (
          <div key={photo.path} style={{ width: cellWidth, padding: 4 }}>
            <Thumbnail
              photo={photo}
              selected={selected.has(photo.path)}
              focused={flatIdx === focusedIndex}
              onSelect={() => onToggle(photo.path)}
              onFocus={() => onFocus(flatIdx)}
              onPreview={() => onPreview(flatIdx)}
              cellWidth={cellWidth}
            />
          </div>
        );
      })}
    </div>
  );
}

export function ImportReview({
  photos,
  deleteAfterImport,
  onToggleDelete,
  onConfirm,
  onCancel,
  initialColumnCount,
  onColumnCountChange,
}: ImportReviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useListRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const initialPaths = useMemo(() => photos.map((p) => p.path), [photos]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialPaths));
  const [columnCount, setColumnCountLocal] = useState(initialColumnCount);
  const setColumnCount = useCallback((val: number | ((prev: number) => number)) => {
    setColumnCountLocal((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      onColumnCountChange(next);
      return next;
    });
  }, [onColumnCountChange]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCancel = useCallback(() => {
    const deselected = initialPaths.filter((p) => !selected.has(p));
    onCancel(deselected);
  }, [initialPaths, selected, onCancel]);

  const toggleSelect = useCallback((path: string) => {
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

  const selectedCount = selected.size;

  // Scroll to focused photo
  useEffect(() => {
    if (focusedIndex >= 0 && previewIndex === null) {
      const rowIndex = Math.floor(focusedIndex / columnCount);
      listRef.current?.scrollToRow({ index: rowIndex, align: "smart", behavior: "smooth" });
    }
  }, [focusedIndex, previewIndex, columnCount, listRef]);

  // Keyboard handling
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (showConfirm) {
        if (e.key === "Enter") {
          e.preventDefault();
          onConfirm(Array.from(selected));
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowConfirm(false);
        }
        return;
      }

      if (previewIndex !== null) return; // Preview handles its own keys

      const lastIndex = photos.length - 1;
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          handleCancel();
          break;
        case "Enter":
          e.preventDefault();
          e.stopPropagation();
          if (e.metaKey && selectedCount > 0) {
            setShowConfirm(true);
          } else if (focusedIndex >= 0) {
            setPreviewIndex(focusedIndex);
          }
          break;
        case " ":
          e.preventDefault();
          if (focusedIndex >= 0 && photos[focusedIndex]) {
            toggleSelect(photos[focusedIndex].path);
          }
          break;
        case "d":
          if (e.metaKey) {
            e.preventDefault();
            onToggleDelete();
          }
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
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, previewIndex, showConfirm, focusedIndex, photos, columnCount, toggleSelect, selectedCount, selected, onConfirm, onToggleDelete]);

  const handlePreviewNavigate = useCallback(
    (delta: number) => {
      setPreviewIndex((prev) => {
        if (prev === null) return null;
        const next = prev + delta;
        let resolved: number;
        if (next < 0) resolved = 0;
        else if (next >= photos.length) resolved = photos.length - 1;
        else resolved = next;
        setFocusedIndex(resolved);
        return resolved;
      });
    },
    [photos.length]
  );

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
  const cellHeight = Math.floor(cellWidth * 0.72);

  const photoRows = useMemo(() => {
    const rows: (PhotoMeta | null)[][] = [];
    for (let i = 0; i < photos.length; i += columnCount) {
      const row: (PhotoMeta | null)[] = [];
      for (let j = 0; j < columnCount; j++) {
        row.push(i + j < photos.length ? photos[i + j] : null);
      }
      rows.push(row);
    }
    return rows;
  }, [photos, columnCount]);

  const rowProps: RowExtraProps = useMemo(
    () => ({ photoRows, cellWidth, selected, focusedIndex, onToggle: toggleSelect, onFocus: setFocusedIndex, onPreview: setPreviewIndex }),
    [photoRows, cellWidth, selected, focusedIndex, toggleSelect]
  );

  return (
    <div className="import-review">
      <div className="import-review-topbar">
        <button className="import-review-back" onClick={handleCancel}>
          ← Back
        </button>
        <span className="import-review-title">
          {selectedCount} of {photos.length} photo{photos.length !== 1 ? "s" : ""} selected for import
        </span>
        <div className="import-review-actions">
          <div className="toolbar-grid-size">
            <span>Grid</span>
            <input
              type="range"
              min={3}
              max={8}
              value={11 - columnCount}
              onChange={(e) => setColumnCount(11 - Number(e.target.value))}
            />
          </div>
          <label className="actionbar-delete-toggle">
            <input
              type="checkbox"
              checked={deleteAfterImport}
              onChange={onToggleDelete}
            />
            <span className={`delete-toggle-track ${deleteAfterImport ? "on" : ""}`}>
              <span className="delete-toggle-knob" />
            </span>
            <span className={deleteAfterImport ? "delete-toggle-label" : ""} style={deleteAfterImport ? { color: "#f87171" } : undefined}>
              Delete from SD after import
            </span>
          </label>
          <button
            className="actionbar-import-btn"
            disabled={selectedCount === 0}
            onClick={() => setShowConfirm(true)}
          >
            Import {selectedCount} Photo{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
      <div className="import-review-grid" ref={containerRef}>
        <List<RowExtraProps>
          listRef={listRef}
          defaultHeight={dimensions.height}
          rowComponent={RowRenderer}
          rowCount={photoRows.length}
          rowHeight={() => cellHeight}
          rowProps={rowProps as any}
          overscanCount={3}
          style={{ width: dimensions.width, height: dimensions.height }}
        />
      </div>

      {showConfirm && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Import {selectedCount} photo{selectedCount !== 1 ? "s" : ""} into Photos?</h3>
            {deleteAfterImport && (
              <p className="dialog-warning">
                Selected photos will be deleted from SD card after import.
              </p>
            )}
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="dialog-btn primary" onClick={() => onConfirm(Array.from(selected))}>Import</button>
            </div>
          </div>
        </div>
      )}

      {previewIndex !== null && (
        <Preview
          photos={photos}
          currentIndex={previewIndex}
          currentPhoto={photos[previewIndex]}
          isSelected={selected.has(photos[previewIndex]?.path)}
          onClose={() => {
            setPreviewIndex(null);
          }}
          onNavigate={handlePreviewNavigate}
          onToggleSelect={() => {
            if (photos[previewIndex]) toggleSelect(photos[previewIndex].path);
          }}
          onDelete={() => {}}
          deleteConfirm={false}
          onDeleteConfirm={() => {}}
          onDeleteCancel={() => {}}
          burstViewIndex={0}
          onBurstNavigate={() => {}}
          burstFocused={false}
          onBurstEnter={() => {}}
          onBurstExit={() => {}}
        />
      )}
    </div>
  );
}
