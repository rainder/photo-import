import { useRef, useState, useEffect, useMemo, useCallback, useImperativeHandle, forwardRef } from "react";
import { List, useListRef } from "react-window";
import type { PhotoMeta } from "../lib/commands";
import { Thumbnail } from "./Thumbnail";
import type { DetectionInfo } from "../lib/detectGroups";

export interface PhotoSection {
  label: string;
  photos: PhotoMeta[];
}

export type BurstInfo = { burstId: number; burstCount: number; burstIndex: number };

interface GridProps {
  sections: PhotoSection[];
  photos: PhotoMeta[];
  isSelected: (path: string) => boolean;
  focusedIndex: number;
  onSelect: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
  onSelectSection: (paths: string[], allSelected: boolean) => void;
  columnCount: number;
  burstMap: Map<string, BurstInfo>;
  rawPairMap: Map<string, string>;
  detectionMap?: Map<string, DetectionInfo>;
  groupBursts: boolean;
  burstSelectedMap: Map<string, number>;
}

type Row =
  | { type: "header"; label: string; photoCount: number; paths: string[]; allSelected: boolean }
  | { type: "photos"; items: (PhotoMeta | null)[]; startIndex: number };

interface RowExtraProps {
  rows: Row[];
  cellWidth: number;
  isSelected: (path: string) => boolean;
  focusedIndex: number;
  onSelect: (path: string) => void;
  onFocus: (index: number) => void;
  onPreview: (index: number) => void;
  onSelectSection: (paths: string[], allSelected: boolean) => void;
  burstMap: Map<string, BurstInfo>;
  rawPairMap: Map<string, string>;
  detectionMap?: Map<string, DetectionInfo>;
  groupBursts: boolean;
  burstSelectedMap: Map<string, number>;
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
    onSelectSection,
    burstMap,
    rawPairMap,
    detectionMap,
    groupBursts,
    burstSelectedMap,
  } = props;
  const row = rows[index];

  if (row.type === "header") {
    return (
      <div style={style} className="grid-section-header">
        <button
          className={`section-checkbox ${row.allSelected ? "checked" : ""}`}
          onClick={() => onSelectSection(row.paths, row.allSelected)}
        >
          {row.allSelected && "✓"}
        </button>
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
              burstInfo={burstMap.get(photo.path)}
              hasRawPair={rawPairMap.has(photo.path)}
              detection={detectionMap?.get(photo.path)}
              isBurstCover={groupBursts && (burstMap.get(photo.path)?.burstIndex === 0) && ((burstMap.get(photo.path)?.burstCount ?? 0) >= 2)}
              burstSelectedCount={burstSelectedMap.get(photo.path)}
            />
          </div>
        );
      })}
    </div>
  );
}

export interface GridHandle {
  scrollToPhoto: (flatIndex: number) => void;
}

export const Grid = forwardRef<GridHandle, GridProps>(function Grid({
  sections,
  photos,
  isSelected,
  focusedIndex,
  onSelect,
  onFocus,
  onPreview,
  onSelectSection,
  columnCount,
  burstMap,
  rawPairMap,
  detectionMap,
  groupBursts,
  burstSelectedMap,
}, ref) {
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
      const sectionPaths = section.photos.map((p) => p.path);
      const allSelected = sectionPaths.length > 0 && sectionPaths.every((p) => isSelected(p));
      result.push({
        type: "header",
        label: section.label,
        photoCount: section.photos.length,
        paths: sectionPaths,
        allSelected,
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
  }, [sections, columnCount, isSelected]);

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
      onSelectSection,
      burstMap,
      rawPairMap,
      detectionMap,
      groupBursts,
      burstSelectedMap,
    }),
    [rows, cellWidth, isSelected, focusedIndex, onSelect, onFocus, onPreview, onSelectSection, burstMap, rawPairMap, detectionMap, groupBursts, burstSelectedMap]
  );

  const listRef = useListRef(null);

  const flatIndexToRowIndex = useCallback((flatIndex: number): number => {
    let accumulated = 0;
    let rowIdx = 0;
    for (const section of sections) {
      rowIdx++; // header
      const sectionRows = Math.ceil(section.photos.length / columnCount);
      if (flatIndex < accumulated + section.photos.length) {
        const offsetInSection = flatIndex - accumulated;
        return rowIdx + Math.floor(offsetInSection / columnCount);
      }
      accumulated += section.photos.length;
      rowIdx += sectionRows;
    }
    return 0;
  }, [sections, columnCount]);

  useImperativeHandle(ref, () => ({
    scrollToPhoto(flatIndex: number) {
      const rowIndex = flatIndexToRowIndex(flatIndex);
      listRef.current?.scrollToRow({ index: rowIndex, align: "smart", behavior: "smooth" });
    },
  }), [flatIndexToRowIndex, listRef]);

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
        listRef={listRef}
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
});
