interface TopBarProps {
  volumeName: string | null;
  photoCount: number;
  autoDetect: boolean;
  onToggleAutoDetect: () => void;
}

export function TopBar({
  volumeName,
  photoCount,
  autoDetect,
  onToggleAutoDetect,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-status">
        <span className={`status-dot ${volumeName ? "connected" : "disconnected"}`} />
        <span className="topbar-label">
          {volumeName ? `${volumeName} — ${photoCount} photos` : "No SD card detected"}
        </span>
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
