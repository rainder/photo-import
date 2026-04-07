export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "0.2.1",
    date: "2026-04-07",
    changes: [
      "Fix ffmpeg, ffprobe, and exiftool not found in bundled .app (PATH not inherited from shell)",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-04-07",
    changes: [
      "GPX geotagging: load multiple GPX files, auto-match photos by timestamp, write GPS EXIF on import",
      "Burst photo grouping: collapsible burst groups in grid with filmstrip navigation in preview (⌘B)",
      "Smart detection: duplicate, timelapse, and panorama badges on thumbnails",
      "Full map view (⌘M) with geotagged photo pins and GPX track overlay",
      "Native macOS app menu with keyboard shortcuts for all actions",
      "Timeline density strip showing photo distribution over time",
      "Exposure histogram (ISO, aperture, shutter speed) in info panel",
      "Mini map in info panel for geotagged photos",
      "Whole-window GPX drag-and-drop",
      "Persist viewing preferences (timeline, info panel, burst grouping)",
      "Section-aware keyboard navigation across date groups",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-04-05",
    changes: [
      "Pinch-to-zoom in preview mode with trackpad gesture support",
      "Zoom toward cursor position for precise control",
      "Double-click to toggle between 1x and 3x zoom",
      "Drag to pan when zoomed in",
      "Fix double-click on thumbnail no longer toggling selection",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-05",
    changes: [
      "Initial release",
      "Auto-detect SD cards with DCIM folders",
      "Browse and select photos with keyboard navigation",
      "Full-size preview mode with arrow key navigation",
      "Import selected photos into Photos.app",
      "Optional delete from SD card after import",
      "Review screen before importing",
      "Grid zoom control (Cmd+/Cmd-)",
      "Eject SD card from the app",
      "Manual folder browsing",
      "Date-grouped photo sections",
      "Section bulk select/deselect",
    ],
  },
];

export const currentVersion = changelog[0];
