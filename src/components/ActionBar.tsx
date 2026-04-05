interface ActionBarProps {
  selectedCount: number;
  onImport: () => void;
  onDeleteSelected: () => void;
  importing: boolean;
}

export function ActionBar({
  selectedCount,
  onImport,
  onDeleteSelected,
  importing,
}: ActionBarProps) {
  return (
    <div className="actionbar">
      <span className="actionbar-shortcuts">
        ← → ↑ ↓ navigate &nbsp;&nbsp; Space select &nbsp;&nbsp; Enter preview &nbsp;&nbsp; ⌘Enter review
      </span>
      <div className="actionbar-buttons">
        <button
          className="actionbar-delete-btn"
          disabled={selectedCount === 0 || importing}
          onClick={onDeleteSelected}
        >
          Delete
        </button>
        <button
          className="actionbar-import-btn"
          disabled={selectedCount === 0 || importing}
          onClick={onImport}
        >
          {importing
            ? "Importing..."
            : "Review"}
        </button>
      </div>
    </div>
  );
}
