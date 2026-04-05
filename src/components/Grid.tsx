import { useRef, useState, useEffect, useMemo } from "react";
import { List } from "react-window";
import type { PhotoMeta } from "../lib/commands";
import { Thumbnail } from "./Thumbnail";

export interface PhotoSection {
  label: string;
  photos: PhotoMeta[];
}

interface GridProps {
  sections: PhotoSection[];
  photos: PhotoMeta[];
  isSelected: (path: string) => boolean;
  focusedIndex: number;
  onSelect: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
  columnCount: number;
}

type Row =
  | { type: "header"; label: string; photoCount: number }
  | { type: "photos"; items: (PhotoMeta | null)[]; startIndex: number };

interface RowExtraProps {
  rows: Row[];
  cellWidth: number;
  isSelected: (path: string) => boolean;
  focusedIndex: number;
  onSelect: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
}

const HEADER_HEIGHT = 40;

function RowRenderer(props: {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: object;
} & RowExtraProps) {
  const {
    index,
    style,
    rows,
    cellWidth,
    isSelected,
    focusedIndex,
    onSelect,
    onFocus,
    onPreview,
  } = props;
  const row = rows[index];

  if (row.type === "header") {
    return (
      <div style={style} className="grid-section-header">
        <span className="grid-section-date">{row.label}</span>
        <span className="grid-section-count">{row.photoCount}</span>
      </div>
    );
  }

  return (
    <div style={{ ...style, display: "flex" }}>
      {row.items.map((photo, colIdx) => {
        if (!photo) return <div key={colIdx} style={{ width: cellWidth }} />;
        const flatIdx = row.startIndex + colIdx;
        return (
          <div key={photo.path} style={{ width: cellWidth, padding: 4 }}>
            <Thumbnail
              photo={photo}
              selected={isSelected(photo.path)}
              focused={flatIdx === focusedIndex}
              onSelect={() => onSelect(photo.path)}
              onFocus={() => onFocus(flatIdx)}
              onPreview={() => onPreview(flatIdx)}
            />
          </div>
        );
      })}
    </div>
  );
}

export function Grid({
  sections,
  photos,
  isSelected,
  focusedIndex,
  onSelect,
  onFocus,
  onPreview,
  columnCount,
}: GridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
  const cellHeight = Math.floor(cellWidth * 0.72);

  const rows = useMemo(() => {
    const result: Row[] = [];
    let flatIndex = 0;

    for (const section of sections) {
      result.push({
        type: "header",
        label: section.label,
        photoCount: section.photos.length,
      });

      for (let i = 0; i < section.photos.length; i += columnCount) {
        const items: (PhotoMeta | null)[] = [];
        for (let j = 0; j < columnCount; j++) {
          items.push(i + j < section.photos.length ? section.photos[i + j] : null);
        }
        result.push({ type: "photos", items, startIndex: flatIndex + i });
      }

      flatIndex += section.photos.length;
    }

    return result;
  }, [sections, columnCount]);

  const getRowHeight = (index: number) => {
    return rows[index].type === "header" ? HEADER_HEIGHT : cellHeight;
  };

  const rowProps: RowExtraProps = useMemo(
    () => ({
      rows,
      cellWidth,
      isSelected,
      focusedIndex,
      onSelect,
      onFocus,
      onPreview,
    }),
    [rows, cellWidth, isSelected, focusedIndex, onSelect, onFocus, onPreview]
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
      <List<RowExtraProps>
        defaultHeight={dimensions.height}
        rowComponent={RowRenderer}
        rowCount={rows.length}
        rowHeight={getRowHeight}
        rowProps={rowProps as any}
        overscanCount={3}
        style={{ width: dimensions.width, height: dimensions.height }}
      />
    </div>
  );
}
