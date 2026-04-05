import { invoke } from "@tauri-apps/api/core";

export interface PhotoMeta {
  name: string;
  path: string;
  size: number;
  date: string;
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

export async function getCameraVolumes(): Promise<CameraVolume[]> {
  return invoke("get_camera_volumes");
}

export async function importToPhotos(paths: string[]): Promise<ImportResult> {
  return invoke("import_to_photos", { paths });
}

export async function deleteFromCard(paths: string[]): Promise<DeleteResult> {
  return invoke("delete_from_card", { paths });
}

export async function ejectVolume(volumePath: string): Promise<void> {
  return invoke("eject_volume", { volumePath });
}
