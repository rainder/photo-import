import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { List } from "react-window";
import type { PhotoMeta } from "../lib/commands";
import { Thumbnail } from "./Thumbnail";

interface ImportReviewProps {
  photos: PhotoMeta[];
  deleteAfterImport: boolean;
  onToggleDelete: () => void;
  onConfirm: (paths: string[]) => void;
  onCancel: () => void;
}

const DEFAULT_COLUMN_COUNT = 6;

interface RowExtraProps {
  photoRows: (PhotoMeta | null)[][];
  cellWidth: number;
  selected: Set<string>;
  onToggle: (path: string) => void;
}

function RowRenderer(props: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: object;
} & RowExtraProps) {
  const { index, style, photoRows, cellWidth, selected, onToggle } = props;
  const items = photoRows[index];

  return (
    <div style={{ ...style, display: "flex" }}>
      {items.map((photo, colIdx) => {
        if (!photo) return <div key={colIdx} style={{ width: cellWidth }} />;
        return (
          <div key={photo.path} style={{ width: cellWidth, padding: 4 }}>
            <Thumbnail
              photo={photo}
              selected={selected.has(photo.path)}
              focused={false}
              onSelect={() => onToggle(photo.path)}
              onFocus={() => {}}
              onPreview={() => {}}
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
}: ImportReviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selected, setSelected] = useState<Set<string>>(() => new Set(photos.map((p) => p.path)));
  const [columnCount, setColumnCount] = useState(DEFAULT_COLUMN_COUNT);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

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
    () => ({ photoRows, cellWidth, selected, onToggle: toggleSelect }),
    [photoRows, cellWidth, selected, toggleSelect]
  );

  return (
    <div className="import-review">
      <div className="import-review-topbar">
        <button className="import-review-back" onClick={onCancel}>
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
              value={columnCount}
              onChange={(e) => setColumnCount(Number(e.target.value))}
            />
          </div>
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
            disabled={selectedCount === 0}
            onClick={() => onConfirm(Array.from(selected))}
          >
            Import {selectedCount} Photo{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
      <div className="import-review-grid" ref={containerRef}>
        <List<RowExtraProps>
          defaultHeight={dimensions.height}
          rowComponent={RowRenderer}
          rowCount={photoRows.length}
          rowHeight={() => cellHeight}
          rowProps={rowProps as any}
          overscanCount={3}
          style={{ width: dimensions.width, height: dimensions.height }}
        />
      </div>
    </div>
  );
}
