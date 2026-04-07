import { invoke } from "@tauri-apps/api/core";

export interface PhotoMeta {
  name: string;
  path: string;
  size: number;
  date: string;
  media_type: "photo" | "video";
  // Photo EXIF metadata
  camera?: string;
  lens?: string;
  focal_length?: string;
  aperture?: string;
  shutter_speed?: string;
  iso?: string;
  width?: number;
  height?: number;
  orientation?: number;
  latitude?: number;
  longitude?: number;
  rating?: number;
  // Video metadata
  duration?: number;
  resolution?: string;
  fps?: string;
  fps_num?: number;
  codec?: string;
}

export interface CameraVolume {
  name: string;
  path: string;
}

export interface ImportResult {
  succeeded: string[];
  failed: { path: string; error: string }[];
}

export interface DeleteResult {
  succeeded: string[];
  failed: { path: string; error: string }[];
}

export async function listPhotos(volumePath: string): Promise<PhotoMeta[]> {
  return invoke("list_photos", { volumePath });
}

export async function getThumbnail(path: string): Promise<string> {
  return invoke("get_thumbnail", { path });
}

export async function getThumbnailHq(path: string, width: number): Promise<string> {
  return invoke("get_thumbnail_hq", { path, width });
}

export async function getCameraVolumes(): Promise<CameraVolume[]> {
  return invoke("get_camera_volumes");
}

export async function importToPhotos(paths: string[]): Promise<ImportResult> {
  return invoke("import_to_photos", { paths });
}

export interface ImportItem {
  path: string;
  lat?: number;
  lon?: number;
}

export async function importWithGps(items: ImportItem[]): Promise<ImportResult> {
  return invoke("import_with_gps", { items });
}

export async function deleteFromCard(paths: string[]): Promise<DeleteResult> {
  return invoke("delete_from_card", { paths });
}

export async function ejectVolume(volumePath: string): Promise<void> {
  return invoke("eject_volume", { volumePath });
}

export async function evictThumbnail(path: string): Promise<void> {
  return invoke("evict_thumbnail", { path });
}

export async function clearThumbnailCache(): Promise<void> {
  return invoke("clear_thumbnail_cache");
}

export interface FfmpegStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
}

export async function checkFfmpeg(): Promise<FfmpegStatus> {
  return invoke("check_ffmpeg");
}

// GPX support

export interface GpxSummary {
  point_count: number;
  start_time: string | null;
  end_time: string | null;
  duration_secs: number | null;
  filename: string;
}

export interface GpxMatch {
  lat: number;
  lon: number;
  source: "gpx";
}

export async function loadGpx(path: string): Promise<GpxSummary> {
  return invoke("load_gpx", { path });
}

export async function unloadGpx(): Promise<void> {
  return invoke("unload_gpx");
}

export async function unloadGpxFile(filename: string): Promise<void> {
  return invoke("unload_gpx_file", { filename });
}

export async function getGpxSummary(): Promise<GpxSummary | null> {
  return invoke("get_gpx_summary");
}

export async function getGpxSummaries(): Promise<GpxSummary[]> {
  return invoke("get_gpx_summaries");
}

export async function matchPhotosToGpx(
  photos: [string, string][],
  timeOffsetSecs: number,
  maxGapSecs: number
): Promise<Record<string, GpxMatch>> {
  return invoke("match_photos_to_gpx", {
    photos,
    timeOffsetSecs,
    maxGapSecs,
  });
}

export async function getGpxTrack(): Promise<[number, number][]> {
  return invoke("get_gpx_track");
}

export async function syncMenuCheck(id: string, checked: boolean): Promise<void> {
  return invoke("sync_menu_check", { id, checked });
}
