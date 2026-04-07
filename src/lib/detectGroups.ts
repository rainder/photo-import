import type { PhotoMeta } from "./commands";

export interface DetectionInfo {
  type: "duplicate" | "timelapse" | "panorama";
  groupId: number;
  groupCount: number;
  label: string;
}

export function detectGroups(photos: PhotoMeta[]): Map<string, DetectionInfo> {
  const map = new Map<string, DetectionInfo>();
  let groupId = 0;

  // 1. Duplicates: same timestamp + same dimensions
  const dupeKey = (p: PhotoMeta) => `${p.date}|${p.width ?? 0}x${p.height ?? 0}`;
  const dupeGroups = new Map<string, PhotoMeta[]>();
  for (const p of photos) {
    if (!p.date) continue;
    const key = dupeKey(p);
    let group = dupeGroups.get(key);
    if (!group) {
      group = [];
      dupeGroups.set(key, group);
    }
    group.push(p);
  }
  for (const group of dupeGroups.values()) {
    if (group.length < 2) continue;
    // Skip if all same path (shouldn't happen) or if they're raw+jpg pairs
    const exts = new Set(group.map((p) => p.name.split(".").pop()?.toLowerCase()));
    if (exts.size > 1) continue; // likely RAW+JPG pair, not a duplicate
    for (const p of group) {
      map.set(p.path, {
        type: "duplicate",
        groupId,
        groupCount: group.length,
        label: `DUP ${group.length}`,
      });
    }
    groupId++;
  }

  // 2. Time-lapse: 5+ photos with consistent intervals (>3s, within 15% tolerance)
  const sorted = photos
    .filter((p) => p.media_type === "photo" && p.date)
    .map((p) => ({ photo: p, time: new Date(p.date).getTime() }))
    .sort((a, b) => a.time - b.time);

  if (sorted.length >= 5) {
    let seqStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      const seqLen = i - seqStart;
      const shouldBreak = i === sorted.length || seqLen < 2;

      if (!shouldBreak && seqLen === 2) {
        // Just started, compute initial interval
        continue;
      }

      if (!shouldBreak) {
        // Check if current interval is consistent with sequence
        const intervals: number[] = [];
        for (let j = seqStart + 1; j < i; j++) {
          intervals.push(sorted[j].time - sorted[j - 1].time);
        }
        const median = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
        const lastInterval = sorted[i].time - sorted[i - 1].time;

        if (median > 3000 && Math.abs(lastInterval - median) / median <= 0.15) {
          continue; // Still consistent
        }
      }

      // End of sequence — check if it's long enough
      if (seqLen >= 5) {
        const intervals: number[] = [];
        for (let j = seqStart + 1; j < i; j++) {
          intervals.push(sorted[j].time - sorted[j - 1].time);
        }
        const median = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];

        if (median > 3000) {
          // Verify consistency
          const consistent = intervals.every(
            (iv) => Math.abs(iv - median) / median <= 0.15
          );
          if (consistent) {
            for (let j = seqStart; j < i; j++) {
              const p = sorted[j].photo;
              if (!map.has(p.path)) {
                map.set(p.path, {
                  type: "timelapse",
                  groupId,
                  groupCount: seqLen,
                  label: `TL ${seqLen}`,
                });
              }
            }
            groupId++;
          }
        }
      }
      seqStart = i;
    }
  }

  // 3. Panorama: 3+ photos within 10s window, same camera, same focal length, >2s apart
  for (let i = 0; i < sorted.length; ) {
    const candidates = [sorted[i]];
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j].time - sorted[i].time <= 10000 &&
      sorted[j].photo.camera === sorted[i].photo.camera &&
      sorted[j].photo.focal_length === sorted[i].photo.focal_length
    ) {
      // Must be >2s apart from previous (not a burst)
      if (sorted[j].time - sorted[j - 1].time > 2000) {
        candidates.push(sorted[j]);
      }
      j++;
    }

    if (candidates.length >= 3) {
      for (const c of candidates) {
        if (!map.has(c.photo.path)) {
          map.set(c.photo.path, {
            type: "panorama",
            groupId,
            groupCount: candidates.length,
            label: `PANO ${candidates.length}`,
          });
        }
      }
      groupId++;
      i = j;
    } else {
      i++;
    }
  }

  return map;
}
