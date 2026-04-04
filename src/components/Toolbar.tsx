type SortBy = "name" | "date";

interface ToolbarProps {
  selectedCount: number;
  totalCount: number;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  columnCount: number;
  onColumnCountChange: (count: number) => void;
}

export function Toolbar({
  selectedCount,
  totalCount,
  sortBy,
  onSortChange,
  onSelectAll,
  onDeselectAll,
  columnCount,
  onColumnCountChange,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={onSelectAll}>Select All</button>
        <button className="toolbar-btn" onClick={onDeselectAll}>Deselect All</button>
        {selectedCount > 0 && (
          <span className="toolbar-count">{selectedCount} selected</span>
        )}
      </div>
      <div className="toolbar-right">
        <select
          className="toolbar-select"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
        >
          <option value="date">Sort: Date</option>
          <option value="name">Sort: Name</option>
        </select>
        <label className="toolbar-grid-size">
          Grid
          <input
            type="range"
            min={3}
            max={8}
            value={columnCount}
            onChange={(e) => onColumnCountChange(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
