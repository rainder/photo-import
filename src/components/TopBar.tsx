interface TopBarProps {
  volumeName: string | null;
  photoCount: number;
}

export function TopBar({
  volumeName,
  photoCount,
}: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-status">
        <span className={`status-dot ${volumeName ? "connected" : "disconnected"}`} />
        <span className="topbar-label">
          {volumeName ? `${volumeName} — ${photoCount} photos` : "No SD card detected"}
        </span>
      </div>
    </div>
  );
}
