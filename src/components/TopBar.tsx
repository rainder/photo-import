interface TopBarProps {
  volumeName: string | null;
  photoCount: number;
  autoDetect: boolean;
  onToggleAutoDetect: () => void;
  onEject: () => void;
  onBrowse: () => void;
  onReload: () => void;
}

export function TopBar({
  volumeName,
  photoCount,
  autoDetect,
  onToggleAutoDetect,
  onEject,
  onBrowse,
  onReload,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-status">
        <span className={`status-dot ${volumeName ? "connected" : "disconnected"}`} />
        <span className="topbar-label">
          {volumeName ? `${volumeName} — ${photoCount} photos` : "No SD card detected"}
        </span>
        {volumeName && (
          <button className="topbar-eject" onClick={onEject} title="Eject SD card">
            ⏏
          </button>
        )}
        <button className="topbar-browse" onClick={onBrowse}>
          Browse...
        </button>
        <button className="topbar-browse" onClick={onReload} title="Clear cache and reload (⌘R)">
          ↻
        </button>
      </div>
      <div className="topbar-toggle">
        <span className="toggle-label">Auto-detect</span>
        <button
          className={`toggle ${autoDetect ? "on" : "off"}`}
          onClick={onToggleAutoDetect}
          role="switch"
          aria-checked={autoDetect}
        >
          <span className="toggle-knob" />
        </button>
      </div>
    </div>
  );
}
