type SortBy = "name-asc" | "name-desc" | "date-asc" | "date-desc";
export type MediaFilter = "all" | "photo" | "video";

interface ToolbarProps {
  selectedCount: number;
  totalCount: number;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  columnCount: number;
  onColumnCountChange: (count: number) => void;
  mediaFilter: MediaFilter;
  onMediaFilterChange: (filter: MediaFilter) => void;
  photoCount: number;
  videoCount: number;
}

export function Toolbar({
  selectedCount,
  totalCount: _totalCount,
  sortBy,
  onSortChange,
  onSelectAll,
  onDeselectAll,
  columnCount,
  onColumnCountChange,
  mediaFilter,
  onMediaFilterChange,
  photoCount,
  videoCount,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-filter">
          <button
            className={`toolbar-filter-btn ${mediaFilter === "all" ? "active" : ""}`}
            onClick={() => onMediaFilterChange("all")}
          >
            All
          </button>
          <button
            className={`toolbar-filter-btn ${mediaFilter === "photo" ? "active" : ""}`}
            onClick={() => onMediaFilterChange("photo")}
          >
            Photos{photoCount > 0 ? ` (${photoCount})` : ""}
          </button>
          <button
            className={`toolbar-filter-btn ${mediaFilter === "video" ? "active" : ""}`}
            onClick={() => onMediaFilterChange("video")}
          >
            Videos{videoCount > 0 ? ` (${videoCount})` : ""}
          </button>
        </div>
        <button className="toolbar-btn" onClick={onSelectAll}>Select All</button>
        <button className="toolbar-btn" onClick={onDeselectAll}>Deselect All</button>
        {selectedCount > 0 && (
          <span className="toolbar-count">{selectedCount} selected</span>
        )}
      </div>
      <div className="toolbar-right">
        <label className="toolbar-grid-size">
          Grid
          <input
            type="range"
            min={3}
            max={8}
            value={11 - columnCount}
            onChange={(e) => onColumnCountChange(11 - Number(e.target.value))}
          />
        </label>
        <select
          className="toolbar-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
        >
          <option value="date-desc">Date ↓</option>
          <option value="date-asc">Date ↑</option>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
        </select>
      </div>
    </div>
  );
}
