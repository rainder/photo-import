interface ActionBarProps {
  selectedCount: number;
  deleteAfterImport: boolean;
  onToggleDelete: () => void;
  onImport: () => void;
  importing: boolean;
}

export function ActionBar({
  selectedCount,
  deleteAfterImport,
  onToggleDelete,
  onImport,
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
  );
}
