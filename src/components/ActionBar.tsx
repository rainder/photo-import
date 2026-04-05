interface ActionBarProps {
  selectedCount: number;
  deleteAfterImport: boolean;
  onToggleDelete: () => void;
  onImport: () => void;
  onDeleteSelected: () => void;
  importing: boolean;
}

export function ActionBar({
  selectedCount,
  deleteAfterImport,
  onToggleDelete,
  onImport,
  onDeleteSelected,
  importing,
}: ActionBarProps) {
  return (
    <div className="actionbar">
      <label className="actionbar-delete-toggle">
        <input
          type="checkbox"
          checked={deleteAfterImport}
          onChange={onToggleDelete}
        />
        Delete from SD card after import
      </label>
      <div className="actionbar-buttons">
        <button
          className="actionbar-delete-btn"
          disabled={selectedCount === 0 || importing}
          onClick={onDeleteSelected}
        >
          Delete {selectedCount} Photo{selectedCount !== 1 ? "s" : ""}
        </button>
        <button
          className="actionbar-import-btn"
          disabled={selectedCount === 0 || importing}
          onClick={onImport}
        >
          {importing
            ? "Importing..."
            : `Import ${selectedCount} Photo${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
