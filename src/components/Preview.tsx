import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoMeta, GpxMatch } from "../lib/commands";
import { convertFileSrc } from "@tauri-apps/api/core";
import { MiniMap } from "./MiniMap";
import { queueThumbnail } from "../lib/thumbnailQueue";

interface PreviewProps {
  photos: PhotoMeta[];
  currentIndex: number;
  currentPhoto: PhotoMeta;
  isSelected: boolean;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onToggleSelect: () => void;
  onDelete: (skipConfirm: boolean) => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  gpxMatch?: GpxMatch;
  gpxTrack?: [number, number][];
  burstMembers?: PhotoMeta[];
  burstViewIndex: number;
  onBurstNavigate: (index: number) => void;
  isPathSelected?: (path: string) => boolean;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ordinal(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = ordinal(d.getDate());
  const month = d.toLocaleString(undefined, { month: "long" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} of ${month}, ${year} ${time}`;
}

export function Preview({
  photos,
  currentIndex,
  currentPhoto,
  isSelected,
  onClose,
  onNavigate,
  onToggleSelect,
  onDelete,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
  gpxMatch,
  gpxTrack,
  burstMembers,
  burstViewIndex,
  onBurstNavigate,
  isPathSelected,
}: PreviewProps) {
  const photo = currentPhoto;
  const [showInfo, setShowInfo] = useState(false);
  const [, forceRender] = useState(0);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const bodyRef = useRef<HTMLDivElement>(null);
  const gestureBaseZoom = useRef(1);

  const update = useCallback(() => forceRender((n) => n + 1), []);

  const clampAndApply = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    zoomRef.current = Math.min(10, Math.max(1, newZoom));
    if (zoomRef.current <= 1) {
      panRef.current = { x: 0, y: 0 };
    } else {
      panRef.current = newPan;
    }
    update();
  }, [update]);

  // Zoom toward a point: keeps the point under cursor fixed
  const zoomToward = useCallback((newZoom: number, clientX: number, clientY: number) => {
    const el = bodyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Cursor position relative to container center
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const oldZoom = zoomRef.current;
    const clamped = Math.min(10, Math.max(1, newZoom));
    const ratio = 1 - clamped / oldZoom;
    const newPan = {
      x: panRef.current.x + (cx - panRef.current.x) * ratio,
      y: panRef.current.y + (cy - panRef.current.y) * ratio,
    };
    clampAndApply(clamped, newPan);
  }, [clampAndApply]);

  // Reset zoom/pan on photo change
  useEffect(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    update();
  }, [currentPhoto.path, update]);

  // Pinch-to-zoom via wheel/gesture events
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const newZoom = zoomRef.current - e.deltaY * 0.01;
        zoomToward(newZoom, e.clientX, e.clientY);
      }
    }

    function handleGestureStart(e: Event) {
      e.preventDefault();
      gestureBaseZoom.current = zoomRef.current;
    }
    function handleGestureChange(e: Event) {
      e.preventDefault();
      const ge = e as unknown as { scale: number; clientX: number; clientY: number };
      const newZoom = gestureBaseZoom.current * ge.scale;
      zoomToward(newZoom, ge.clientX, ge.clientY);
    }

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("gesturestart", handleGestureStart);
    el.addEventListener("gesturechange", handleGestureChange);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("gesturestart", handleGestureStart);
      el.removeEventListener("gesturechange", handleGestureChange);
    };
  }, [zoomToward]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (zoomRef.current <= 1) return;
    isPanning.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
    update();
  }, [update]);

  const handlePointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Double-click to toggle zoom toward cursor
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (zoomRef.current > 1) {
      clampAndApply(1, { x: 0, y: 0 });
    } else {
      zoomToward(3, e.clientX, e.clientY);
    }
  }, [clampAndApply, zoomToward]);

  const zoom = zoomRef.current;
  const pan = panRef.current;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (deleteConfirm) {
        if (e.key === "Enter") {
          e.preventDefault();
          onDeleteConfirm();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onDeleteCancel();
        }
        return;
      }

      if (e.metaKey && e.key === "i") {
        e.preventDefault();
        setShowInfo((v) => !v);
        return;
      }

      switch (e.key) {
        case "Enter":
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          onNavigate(-1);
          break;
        case "ArrowRight":
          onNavigate(1);
          break;
        case " ":
          e.preventDefault();
          onToggleSelect();
          break;
        case "Backspace":
          e.preventDefault();
          onDelete(e.metaKey);
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, onToggleSelect, onDelete, deleteConfirm, onDeleteConfirm, onDeleteCancel]);

  const imageSrc = convertFileSrc(photo.path);

  return (
    <div className="preview-overlay">
      <div className="preview-topbar">
        <div className="preview-info">
          <span className="preview-filename">{photo.name}</span>
          <span className="preview-meta">
            {formatSize(photo.size)} — {formatDate(photo.date)}
          </span>
          {photo.media_type === "photo" && (photo.camera || photo.aperture || photo.iso) && (
            <span className="preview-exif">
              {[
                photo.camera,
                photo.lens,
                photo.focal_length,
                photo.aperture,
                photo.shutter_speed,
                photo.iso ? `ISO ${photo.iso}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          {photo.media_type === "video" && (
            <span className="preview-exif">
              {[
                photo.resolution,
                photo.fps,
                photo.codec,
                photo.duration ? formatDuration(photo.duration) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>
        <div className="preview-nav-info">
          <span>
            {currentIndex + 1} of {photos.length}
            {burstMembers && burstMembers.length > 1 && (
              <span className="burst-position"> · burst {burstViewIndex + 1}/{burstMembers.length}</span>
            )}
          </span>
          <button className="preview-close" onClick={onClose}>
            Esc ✕
          </button>
        </div>
      </div>

      <div
        className="preview-body"
        ref={bodyRef}
        onPointerDown={photo.media_type === "video" ? undefined : handlePointerDown}
        onPointerMove={photo.media_type === "video" ? undefined : handlePointerMove}
        onPointerUp={photo.media_type === "video" ? undefined : handlePointerUp}
        onDoubleClick={photo.media_type === "video" ? undefined : handleDoubleClick}
        style={{ cursor: photo.media_type === "video" ? "default" : zoom > 1 ? (isPanning.current ? "grabbing" : "grab") : "default" }}
      >
        <button
          className="preview-arrow preview-arrow-left"
          onClick={() => onNavigate(-1)}
        >
          ←
        </button>

        {photo.media_type === "video" ? (
          <video
            className="preview-image"
            src={imageSrc}
            controls
            autoPlay
            draggable={false}
          />
        ) : (
          <img
            className="preview-image"
            src={imageSrc}
            alt={photo.name}
            draggable={false}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isPanning.current ? "none" : "transform 0.15s ease-out",
            }}
          />
        )}

        <button
          className="preview-arrow preview-arrow-right"
          onClick={() => onNavigate(1)}
        >
          →
        </button>
      </div>

      <div className={`burst-filmstrip ${burstMembers && burstMembers.length > 1 ? "open" : ""}`}>
        {burstMembers && burstMembers.length > 1 && (
          <>
            <span className="burst-filmstrip-counter">{burstViewIndex + 1} / {burstMembers.length}</span>
            <div className="burst-filmstrip-track">
              {burstMembers.map((member, i) => (
                <BurstThumb
                  key={member.path}
                  path={member.path}
                  active={i === burstViewIndex}
                  selected={isPathSelected ? isPathSelected(member.path) : false}
                  onClick={() => onBurstNavigate(i)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="preview-bottombar">
        <button className="preview-select-toggle" onClick={onToggleSelect}>
          <span className={`preview-checkbox ${isSelected ? "checked" : ""}`}>
            {isSelected && "✓"}
          </span>
          <span>Select for import</span>
        </button>
        <span className="preview-shortcuts">
          ← → navigate &nbsp;&nbsp; Space select &nbsp;&nbsp; ⌫ delete &nbsp;&nbsp; ⌘I info &nbsp;&nbsp; Enter close
        </span>
      </div>

      <div className={`preview-info-panel ${showInfo ? "open" : ""}`}>
        <div className="preview-info-panel-header">
          <span>Info</span>
          <button onClick={() => setShowInfo(false)}>✕</button>
        </div>
        <div className="preview-info-panel-body">
          <InfoRow label="File" value={photo.name} />
          <InfoRow label="Size" value={formatSize(photo.size)} />
          <InfoRow label="Date" value={formatDate(photo.date)} />
          {photo.width && photo.height && (
            <InfoRow label="Dimensions" value={`${photo.width} × ${photo.height}`} />
          )}
          {photo.media_type === "photo" && (
            <>
              <InfoRow label="Camera" value={photo.camera} />
              <InfoRow label="Lens" value={photo.lens} />
              <InfoRow label="Focal Length" value={photo.focal_length} />
              <InfoRow label="Aperture" value={photo.aperture} />
              <InfoRow label="Shutter" value={photo.shutter_speed} />
              <InfoRow label="ISO" value={photo.iso} />
            </>
          )}
          {photo.media_type === "video" && (
            <>
              <InfoRow label="Duration" value={photo.duration ? formatDuration(photo.duration) : undefined} />
              <InfoRow label="Resolution" value={photo.resolution} />
              <InfoRow label="Frame Rate" value={photo.fps} />
              <InfoRow label="Codec" value={photo.codec} />
            </>
          )}
          {(() => {
            const lat = photo.latitude ?? gpxMatch?.lat;
            const lon = photo.longitude ?? gpxMatch?.lon;
            const src = photo.latitude != null ? "" : gpxMatch ? " (GPX)" : "";
            return lat != null && lon != null ? (
              <>
                <div className="grid-info-map" style={{ margin: "8px 0" }}>
                  <MiniMap lat={lat} lon={lon} gpxTrack={gpxTrack ?? []} />
                </div>
                <InfoRow label="GPS" value={`${lat.toFixed(5)}, ${lon.toFixed(5)}${src}`} />
              </>
            ) : null;
          })()}
          {photo.rating != null && photo.rating > 0 && (
            <InfoRow label="Rating" value={"★".repeat(photo.rating) + "☆".repeat(5 - photo.rating)} />
          )}
          <InfoRow label="Path" value={photo.path} />
        </div>
      </div>

      {deleteConfirm && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h3>Delete "{photo.name}" from SD card?</h3>
            <p className="dialog-warning">This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="dialog-btn secondary" onClick={onDeleteCancel}>Cancel</button>
              <button className="dialog-btn danger" onClick={onDeleteConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BurstThumb({ path, active, selected, onClick }: { path: string; active: boolean; selected: boolean; onClick: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    queueThumbnail(path).then((url) => { if (!cancelled) setSrc(url); }, () => {});
    return () => { cancelled = true; };
  }, [path]);

  return (
    <button
      className={`burst-filmstrip-thumb ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {src ? <img src={src} alt="" draggable={false} /> : <div className="burst-filmstrip-placeholder" />}
      {selected && <span className="burst-filmstrip-check">✓</span>}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="preview-info-row">
      <span className="preview-info-label">{label}</span>
      <span className="preview-info-value">{value}</span>
    </div>
  );
}
