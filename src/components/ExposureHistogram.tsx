import { useMemo } from "react";
import type { PhotoMeta } from "../lib/commands";

export function ExposureHistogram({ photos }: { photos: PhotoMeta[] }) {
  const data = useMemo(() => {
    const isoMap = new Map<string, number>();
    const apertureMap = new Map<string, number>();
    const shutterMap = new Map<string, number>();

    for (const p of photos) {
      if (p.media_type !== "photo") continue;
      if (p.iso) {
        const v = p.iso;
        isoMap.set(v, (isoMap.get(v) ?? 0) + 1);
      }
      if (p.aperture) {
        const v = p.aperture;
        apertureMap.set(v, (apertureMap.get(v) ?? 0) + 1);
      }
      if (p.shutter_speed) {
        const v = p.shutter_speed;
        shutterMap.set(v, (shutterMap.get(v) ?? 0) + 1);
      }
    }

    const sortNumeric = (entries: [string, number][]) =>
      entries.sort((a, b) => {
        const na = parseFloat(a[0].replace(/[^0-9./-]/g, "")) || 0;
        const nb = parseFloat(b[0].replace(/[^0-9./-]/g, "")) || 0;
        return na - nb;
      });

    const sortShutter = (entries: [string, number][]) =>
      entries.sort((a, b) => {
        const va = evalShutter(a[0]);
        const vb = evalShutter(b[0]);
        return va - vb;
      });

    return {
      iso: sortNumeric(Array.from(isoMap)),
      aperture: sortNumeric(Array.from(apertureMap)),
      shutter: sortShutter(Array.from(shutterMap)),
    };
  }, [photos]);

  const hasData = data.iso.length > 0 || data.aperture.length > 0 || data.shutter.length > 0;
  if (!hasData) return null;

  return (
    <div className="exposure-histogram">
      {data.iso.length > 0 && (
        <HistogramSection title="ISO" entries={data.iso} />
      )}
      {data.aperture.length > 0 && (
        <HistogramSection title="Aperture" entries={data.aperture} />
      )}
      {data.shutter.length > 0 && (
        <HistogramSection title="Shutter" entries={data.shutter} />
      )}
    </div>
  );
}

function HistogramSection({
  title,
  entries,
}: {
  title: string;
  entries: [string, number][];
}) {
  const max = Math.max(...entries.map(([, c]) => c));

  return (
    <div className="histogram-section">
      <div className="histogram-title">{title}</div>
      {entries.map(([label, count]) => (
        <div key={label} className="histogram-row">
          <span className="histogram-label">{label}</span>
          <div className="histogram-bar-track">
            <div
              className="histogram-bar-fill"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="histogram-count">{count}</span>
        </div>
      ))}
    </div>
  );
}

function evalShutter(s: string): number {
  const m = s.match(/^1\/(\d+)/);
  if (m) return 1 / parseInt(m[1], 10);
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
