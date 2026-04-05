export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
