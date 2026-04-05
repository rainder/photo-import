import { useEffect, useState } from "react";
import { queueThumbnail, cancelPending } from "../lib/thumbnailQueue";

interface ThumbnailProps {
  photo: { name: string; path: string };
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onPreview: () => void;
}

export function Thumbnail({
  photo,
  selected,
  focused,
  onSelect,
  onFocus,
  onPreview,
}: ThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
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

  return (
    <div
      className={`thumbnail ${selected ? "selected" : ""} ${focused ? "focused" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onFocus();
      }}
      onDoubleClick={onPreview}
    >
      {src ? (
        <img src={src} alt={photo.name} draggable={false} />
      ) : (
        <div className="thumbnail-placeholder" />
      )}
      <div
        className={`thumbnail-checkbox ${selected ? "checked" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {selected && "\u2713"}
      </div>
      <div className="thumbnail-name">{photo.name}</div>
    </div>
  );
}
