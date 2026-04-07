import { useRef, useEffect, useCallback, useState } from "react";
import type { PhotoMeta } from "../lib/commands";

const STRIP_HEIGHT = 36;
const BAR_COLOR = "rgba(148, 163, 184, 0.45)";
const FOCUS_COLOR = "#cbd5e1";

export function TimelineStrip({
  photos,
  focusedIndex,
  onFocus,
}: {
  photos: PhotoMeta[];
  focusedIndex: number;
  onFocus: (index: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Parse times once
  const times = useRef<{ time: number; index: number }[]>([]);
  useEffect(() => {
    times.current = photos
      .map((p, i) => ({ time: new Date(p.date).getTime(), index: i }))
      .filter((t) => !isNaN(t.time))
      .sort((a, b) => a.time - b.time);
  }, [photos]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || times.current.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = STRIP_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, STRIP_HEIGHT);

    const t = times.current;
    const minT = t[0].time;
    const maxT = t[t.length - 1].time;
    const range = maxT - minT;
    if (range === 0) return;

    // Bucket into columns
    const bucketCount = Math.min(width, t.length);
    const buckets = new Array(bucketCount).fill(0);
    for (const { time } of t) {
      const bucket = Math.min(
        Math.floor(((time - minT) / range) * bucketCount),
        bucketCount - 1
      );
      buckets[bucket]++;
    }

    const maxCount = Math.max(...buckets);
    const barWidth = width / bucketCount;

    ctx.fillStyle = BAR_COLOR;
    for (let i = 0; i < bucketCount; i++) {
      if (buckets[i] === 0) continue;
      const h = (buckets[i] / maxCount) * (STRIP_HEIGHT - 4);
      ctx.fillRect(
        i * barWidth,
        STRIP_HEIGHT - h - 2,
        Math.max(barWidth - 0.5, 1),
        h
      );
    }

    // Focus indicator
    const focusedPhoto = photos[focusedIndex];
    if (focusedPhoto?.date) {
      const ft = new Date(focusedPhoto.date).getTime();
      if (!isNaN(ft)) {
        const x = ((ft - minT) / range) * width;
        ctx.fillStyle = FOCUS_COLOR;
        ctx.fillRect(Math.round(x) - 1, 0, 2, STRIP_HEIGHT);
      }
    }

    // Day separators
    ctx.font = "9px -apple-system, sans-serif";
    ctx.textBaseline = "top";
    const startDate = new Date(minT);
    const endDate = new Date(maxT);

    // Find midnight boundaries between start and end
    const day = new Date(startDate);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + 1); // first midnight after start
    const dateFmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    while (day.getTime() < maxT) {
      const x = ((day.getTime() - minT) / range) * width;
      // Vertical line
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(Math.round(x), 0, 1, STRIP_HEIGHT);
      // Date label
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      const label = day.toLocaleDateString(undefined, dateFmt);
      ctx.fillText(label, Math.round(x) + 3, 2);
      day.setDate(day.getDate() + 1);
    }

    // Time labels at edges
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    const fmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
    ctx.fillText(startDate.toLocaleTimeString(undefined, fmt), 4, 2);
    const endLabel = endDate.toLocaleTimeString(undefined, fmt);
    const endW = ctx.measureText(endLabel).width;
    ctx.fillText(endLabel, width - endW - 4, 2);
  }, [width, photos, focusedIndex]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (times.current.length < 2) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / width;

      const t = times.current;
      const minT = t[0].time;
      const maxT = t[t.length - 1].time;
      const targetTime = minT + ratio * (maxT - minT);

      // Find closest photo
      let closest = t[0];
      let closestDist = Math.abs(t[0].time - targetTime);
      for (const entry of t) {
        const dist = Math.abs(entry.time - targetTime);
        if (dist < closestDist) {
          closest = entry;
          closestDist = dist;
        }
      }
      onFocus(closest.index);
    },
    [width, onFocus]
  );

  if (photos.length < 2) return null;

  return (
    <div className="timeline-strip" ref={containerRef} onClick={handleClick}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: STRIP_HEIGHT, cursor: "pointer" }}
      />
    </div>
  );
}
