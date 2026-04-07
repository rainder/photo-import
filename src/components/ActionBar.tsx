interface ActionBarProps {
  selectedCount: number;
  onImport: () => void;
  importing: boolean;
}

export function ActionBar({
  selectedCount,
  onImport,
  importing,
}: ActionBarProps) {
  return (
    <div className="actionbar">
      <span className="actionbar-shortcuts">
        ← → ↑ ↓ navigate &nbsp;&nbsp; Space select &nbsp;&nbsp; Enter preview &nbsp;&nbsp; ⌘Enter review
      </span>
      <div className="actionbar-buttons">
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
