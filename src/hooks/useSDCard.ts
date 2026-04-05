import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCameraVolumes, type CameraVolume } from "../lib/commands";

export function useSDCard(autoDetect: boolean) {
  const [volume, setVolume] = useState<CameraVolume | null>(null);

  useEffect(() => {
    if (!autoDetect) return;

    getCameraVolumes().then((volumes) => {
      if (volumes.length > 0) {
        setVolume(volumes[0]);
      }
    });

    const unlistenMount = listen<CameraVolume>("sd-card-mounted", (event) => {
      setVolume(event.payload);
    });

    const unlistenUnmount = listen<string>("sd-card-unmounted", () => {
      setVolume(null);
    });

    return () => {
      unlistenMount.then((fn) => fn());
      unlistenUnmount.then((fn) => fn());
    };
  }, [autoDetect]);

  const setManualVolume = (vol: CameraVolume | null) => {
    setVolume(vol);
  };

  return { volume, setManualVolume };
}
