import type { GpxSummary } from "../lib/commands";

export function GpxBar({
  summaries,
  matchCount,
  loading,
  onUnloadFile,
  onUnloadAll,
}: {
  summaries: GpxSummary[];
  matchCount: number;
  loading: boolean;
  onUnloadFile: (filename: string) => void;
  onUnloadAll: () => void;
}) {
  if (loading) {
    return (
      <div className="gpx-bar">
        <span className="gpx-bar-loading">Loading GPX file...</span>
      </div>
    );
  }

  if (summaries.length === 0) return null;

  const totalPoints = summaries.reduce((sum, s) => sum + s.point_count, 0);
  const multiFile = summaries.length > 1;

  return (
    <div className="gpx-bar gpx-bar-loaded">
      <div className="gpx-bar-info">
        <span className="gpx-bar-icon">&#x1F4CD;</span>
        <div className="gpx-bar-files">
          {summaries.map((s) => (
            <span key={s.filename} className="gpx-bar-file">
              <span className="gpx-bar-filename">{s.filename}</span>
              <span className="gpx-bar-detail">
                {s.point_count} pts
                {s.start_time && s.end_time
                  ? ` \u00B7 ${formatTimeRange(s.start_time, s.end_time)}`
                  : ""}
                {s.duration_secs ? ` (${formatGpxDuration(s.duration_secs)})` : ""}
                {!multiFile && matchCount > 0
                  ? ` \u00B7 ${matchCount} photo${matchCount !== 1 ? "s" : ""} matched`
                  : ""}
              </span>
              {multiFile && (
                <button
                  className="gpx-bar-file-remove"
                  onClick={() => onUnloadFile(s.filename)}
                  title={`Remove ${s.filename}`}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        {multiFile && (
          <span className="gpx-bar-detail gpx-bar-match-count">
            {totalPoints} total pts
            {matchCount > 0
              ? ` \u00B7 ${matchCount} photo${matchCount !== 1 ? "s" : ""} matched`
              : ""}
          </span>
        )}
      </div>
      <button className="gpx-bar-remove" onClick={multiFile ? onUnloadAll : () => onUnloadFile(summaries[0].filename)}>
        Remove{multiFile ? " all" : ""}
      </button>
    </div>
  );
}

function formatGpxDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateOpts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const sameDay = s.toDateString() === e.toDateString();
  if (sameDay) {
    return `${s.toLocaleDateString(undefined, dateOpts)} ${s.toLocaleTimeString(undefined, timeOpts)}\u2013${e.toLocaleTimeString(undefined, timeOpts)}`;
  }
  return `${s.toLocaleDateString(undefined, dateOpts)} ${s.toLocaleTimeString(undefined, timeOpts)} \u2013 ${e.toLocaleDateString(undefined, dateOpts)} ${e.toLocaleTimeString(undefined, timeOpts)}`;
}
