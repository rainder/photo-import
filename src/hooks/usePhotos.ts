import { useEffect, useState } from "react";
import { listPhotos, type PhotoMeta } from "../lib/commands";

export function usePhotos(volumePath: string | null) {
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!volumePath) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    listPhotos(volumePath).then(
      (result) => {
        if (!cancelled) {
          setPhotos(result);
          setLoading(false);
        }
      },
      (err) => {
        if (!cancelled) {
          console.error("Failed to list photos:", err);
          setPhotos([]);
          setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [volumePath]);

  const removePhoto = (path: string) => {
    setPhotos((prev) => prev.filter((p) => p.path !== path));
  };

  const removePhotos = (paths: Set<string>) => {
    setPhotos((prev) => prev.filter((p) => !paths.has(p.path)));
  };

  return { photos, loading, removePhoto, removePhotos };
}
