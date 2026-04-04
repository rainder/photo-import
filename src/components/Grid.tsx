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
  const cellHeight = Math.floor(cellWidth * 0.72);
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
