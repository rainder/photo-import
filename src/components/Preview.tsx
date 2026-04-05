import { useEffect } from "react";
import type { PhotoMeta } from "../lib/commands";
import { convertFileSrc } from "@tauri-apps/api/core";

interface PreviewProps {
  photos: PhotoMeta[];
  currentIndex: number;
  isSelected: boolean;
  onClose: () => void;
  onNavigate: (delta: number) => void;
  onToggleSelect: () => void;
  onDelete: (skipConfirm: boolean) => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
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
  onDelete,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
}: PreviewProps) {
  const photo = photos[currentIndex];

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
        <button className="preview-select-toggle" onClick={onToggleSelect}>
          <span className={`preview-checkbox ${isSelected ? "checked" : ""}`}>
            {isSelected && "✓"}
          </span>
          <span>Select for import</span>
        </button>
        <span className="preview-shortcuts">
          ← → navigate &nbsp;&nbsp; Space select &nbsp;&nbsp; ⌫ delete &nbsp;&nbsp; Enter close
        </span>
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
