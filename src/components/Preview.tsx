import { useEffect } from "react";
import { PhotoMeta } from "../lib/commands";
import { convertFileSrc } from "@tauri-apps/api/core";

interface PreviewProps {
  photos: PhotoMeta[];
  currentIndex: number;
  isSelected: boolean;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onToggleSelect: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Preview({
  photos,
  currentIndex,
  isSelected,
  onClose,
  onNavigate,
  onToggleSelect,
}: PreviewProps) {
  const photo = photos[currentIndex];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
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
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate, onToggleSelect]);

  const imageSrc = convertFileSrc(photo.path);

  return (
    <div className="preview-overlay">
      <div className="preview-topbar">
        <div className="preview-info">
          <span className="preview-filename">{photo.name}</span>
          <span className="preview-meta">
            {formatSize(photo.size)} — {new Date(photo.date).toLocaleDateString()}
          </span>
        </div>
        <div className="preview-nav-info">
          <span>
            {currentIndex + 1} of {photos.length}
          </span>
          <button className="preview-close" onClick={onClose}>
            Esc ✕
          </button>
        </div>
      </div>

      <div className="preview-body">
        <button
          className="preview-arrow preview-arrow-left"
          onClick={() => onNavigate(-1)}
        >
          ←
        </button>

        <img
          className="preview-image"
          src={imageSrc}
          alt={photo.name}
          draggable={false}
        />

        <button
          className="preview-arrow preview-arrow-right"
          onClick={() => onNavigate(1)}
        >
          →
        </button>
      </div>

      <div className="preview-bottombar">
        <label className="preview-select-toggle">
          <div
            className={`thumbnail-checkbox ${isSelected ? "checked" : ""}`}
            onClick={onToggleSelect}
          >
            {isSelected && "\u2713"}
          </div>
          <span>Select for import</span>
        </label>
        <span className="preview-shortcuts">
          ← → navigate &nbsp;&nbsp; Space select &nbsp;&nbsp; Esc close
        </span>
      </div>
    </div>
  );
}
