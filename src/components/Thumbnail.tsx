import { useCallback, useEffect, useRef, useState } from "react";
import { queueThumbnail, cancelPending, queueThumbnailHq, cancelPendingHq } from "../lib/thumbnailQueue";
import { formatDuration } from "./Preview";
import type { BurstInfo } from "./Grid";
import type { PhotoMeta } from "../lib/commands";
import type { DetectionInfo } from "../lib/detectGroups";

interface ThumbnailProps {
  photo: PhotoMeta;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onPreview: () => void;
  burstInfo?: BurstInfo;
  hasRawPair?: boolean;
  detection?: DetectionInfo;
  isBurstCover?: boolean;
  burstSelectedCount?: number;
  cellWidth: number;
}

export function Thumbnail({
  photo,
  selected,
  focused,
  onSelect,
  onFocus,
  onPreview,
  burstInfo,
  hasRawPair,
  detection,
  isBurstCover,
  burstSelectedCount,
  cellWidth,
}: ThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [hqSrc, setHqSrc] = useState<string | null>(null);
  const [hqLoading, setHqLoading] = useState(false);
  const hqWidthRef = useRef(0); // track the width we last requested HQ at

  const firstPassNaturalWidth = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setHqSrc(null);
    setHqLoading(false);
    hqWidthRef.current = 0;
    firstPassNaturalWidth.current = 0;
    queueThumbnail(photo.path).then(
      (dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      },
      () => {}
    );
    return () => {
      cancelled = true;
      cancelPending(photo.path);
    };
  }, [photo.path]);

  // Request HQ upgrade if needed — called from onLoad and when cellWidth changes
  const maybeUpgrade = useCallback(() => {
    const sourceWidth = firstPassNaturalWidth.current;
    if (sourceWidth === 0) return;
    const targetWidth = Math.min(Math.ceil(cellWidth * window.devicePixelRatio), 800);
    if (hqWidthRef.current >= targetWidth) return;
    const needed = cellWidth * window.devicePixelRatio * 0.5;
    if (sourceWidth >= needed) return;
    hqWidthRef.current = targetWidth;
    setHqLoading(true);
    queueThumbnailHq(photo.path, targetWidth).then(
      (dataUrl) => { setHqSrc(dataUrl); setHqLoading(false); },
      () => setHqLoading(false)
    );
  }, [cellWidth, photo.path]);

  // Re-evaluate when cell size changes (user zooms grid)
  useEffect(() => {
    maybeUpgrade();
  }, [maybeUpgrade]);

  // Badges for top-left corner
  const topLeftBadges: string[] = [];
  if (photo.latitude != null && photo.longitude != null) topLeftBadges.push("📍");
  if (photo.rating && photo.rating > 0) topLeftBadges.push("★".repeat(photo.rating));
  if (isRawFile(photo.name)) {
    topLeftBadges.push("RAW");
  } else if (hasRawPair) {
    topLeftBadges.push("+RAW");
  }

  // Exposure warning
  const exposureWarning = getExposureWarning(photo);

  // Video: slow-mo / codec warning
  const isSlowMo = photo.media_type === "video" && photo.fps_num != null && photo.fps_num >= 120;
  const codecWarning = photo.media_type === "video" && photo.codec && ["H.265", "ProRes"].includes(photo.codec);

  return (
    <div
      className={`thumbnail ${selected ? "selected" : ""} ${focused ? "focused" : ""} ${isBurstCover ? "burst-stack" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onFocus();
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
        } else {
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            onSelect();
          }, 200);
        }
      }}
      onDoubleClick={onPreview}
    >
      {src ? (
        <img
          ref={imgRef}
          src={hqSrc ?? src}
          alt={photo.name}
          draggable={false}
          onLoad={() => {
            const img = imgRef.current;
            if (!img) return;
            // Record first-pass natural width (only once, not after HQ swap)
            if (firstPassNaturalWidth.current === 0) {
              firstPassNaturalWidth.current = img.naturalWidth;
            }
            maybeUpgrade();
          }}
        />
      ) : (
        <div className="thumbnail-placeholder" />
      )}

      {hqLoading && <div className="thumbnail-hq-loading" />}

      {/* Top-left badges */}
      {topLeftBadges.length > 0 && (
        <div className="thumbnail-badges-left">
          {topLeftBadges.map((b, i) => (
            <span key={i} className="thumbnail-badge">{b}</span>
          ))}
        </div>
      )}

      {/* Top-right: burst or detection */}
      {burstInfo && burstInfo.burstIndex === 0 && (
        <div className="thumbnail-burst-badge">
          ◆ {burstInfo.burstCount}
        </div>
      )}
      {detection && !burstInfo && (
        <div className={`thumbnail-burst-badge thumbnail-detect-${detection.type}`}>
          {detection.label}
        </div>
      )}

      {/* Bottom-left: video info */}
      {photo.media_type === "video" && (
        <div className="thumbnail-video-badge">
          ▶{photo.duration ? ` ${formatDuration(photo.duration)}` : ""}
          {isSlowMo && " SLO-MO"}
        </div>
      )}

      {/* Bottom-right: warnings */}
      {(exposureWarning || codecWarning) && (
        <div className="thumbnail-badges-right">
          {exposureWarning && <span className="thumbnail-badge warn">{exposureWarning}</span>}
          {codecWarning && <span className="thumbnail-badge warn">{photo.codec}</span>}
        </div>
      )}

      <div
        className={`thumbnail-checkbox ${burstSelectedCount ? "burst-has-selected" : selected ? "checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {burstSelectedCount ? burstSelectedCount : selected ? "\u2713" : ""}
      </div>
    </div>
  );
}

function isRawFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["cr2", "cr3", "nef", "arw", "raf", "dng", "orf", "rw2", "pef", "srw"].includes(ext);
}

function getExposureWarning(photo: PhotoMeta): string | null {
  if (photo.media_type !== "photo") return null;
  const iso = photo.iso ? parseInt(photo.iso, 10) : null;
  // Very high ISO suggests noisy/underexposed
  if (iso && iso >= 6400) return "⚠ HIGH ISO";
  return null;
}
