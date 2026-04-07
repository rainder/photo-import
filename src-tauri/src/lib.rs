mod gpx_support;
mod import;
mod photos;
mod volumes;

use gpx_support::{GpxMatch, GpxSummary};
use import::{DeleteResult, ImportItem, ImportResult};
use photos::PhotoMeta;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::menu::{CheckMenuItem, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;
use volumes::CameraVolume;

/// Resolve an external CLI tool by checking common Homebrew/system paths.
/// macOS .app bundles don't inherit the user's shell PATH.
pub fn resolve_tool(name: &str) -> PathBuf {
    let candidates = [
        format!("/opt/homebrew/bin/{name}"),
        format!("/usr/local/bin/{name}"),
        format!("/usr/bin/{name}"),
    ];
    for c in &candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return p;
        }
    }
    // Fall back to bare name (works if PATH is set, e.g. dev builds)
    PathBuf::from(name)
}

#[tauri::command]
async fn list_photos(volume_path: String) -> Result<Vec<PhotoMeta>, String> {
    tokio::task::spawn_blocking(move || photos::scan_dcim(&volume_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_thumbnail(path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || photos::get_thumbnail(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_camera_volumes() -> Vec<CameraVolume> {
    volumes::list_camera_volumes()
}

#[tauri::command]
fn import_to_photos(paths: Vec<String>) -> ImportResult {
    import::import_to_photos(&paths)
}

#[tauri::command]
fn delete_from_card(paths: Vec<String>) -> DeleteResult {
    import::delete_from_card(&paths)
}

#[tauri::command]
fn import_with_gps(items: Vec<ImportItem>) -> ImportResult {
    import::import_to_photos_with_gps(&items)
}

#[tauri::command]
fn eject_volume(volume_path: String) -> Result<(), String> {
    volumes::eject_volume(&volume_path)
}

#[tauri::command]
fn evict_thumbnail(path: String) {
    photos::evict_thumbnail(&path);
}

#[tauri::command]
fn clear_thumbnail_cache() {
    photos::clear_thumbnail_cache();
}

#[tauri::command]
fn check_ffmpeg() -> FfmpegStatus {
    let has_ffmpeg = std::process::Command::new(resolve_tool("ffmpeg"))
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok();
    let has_ffprobe = std::process::Command::new(resolve_tool("ffprobe"))
        .arg("-version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok();
    FfmpegStatus {
        ffmpeg: has_ffmpeg,
        ffprobe: has_ffprobe,
    }
}

#[derive(serde::Serialize)]
struct FfmpegStatus {
    ffmpeg: bool,
    ffprobe: bool,
}

#[tauri::command]
async fn load_gpx(path: String) -> Result<GpxSummary, String> {
    tokio::task::spawn_blocking(move || gpx_support::load_gpx(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn unload_gpx() {
    gpx_support::unload_gpx();
}

#[tauri::command]
fn unload_gpx_file(filename: String) {
    gpx_support::unload_gpx_file(&filename);
}

#[tauri::command]
fn get_gpx_summary() -> Option<GpxSummary> {
    gpx_support::get_gpx_summary()
}

#[tauri::command]
fn get_gpx_summaries() -> Vec<GpxSummary> {
    gpx_support::get_gpx_summaries()
}

#[tauri::command]
async fn match_photos_to_gpx(
    photos: Vec<(String, String)>,
    time_offset_secs: i64,
    max_gap_secs: f64,
) -> HashMap<String, GpxMatch> {
    tokio::task::spawn_blocking(move || {
        gpx_support::match_photos_to_gpx(&photos, time_offset_secs, max_gap_secs)
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
fn get_gpx_track() -> Vec<(f64, f64)> {
    gpx_support::get_gpx_track()
}

#[tauri::command]
fn sync_menu_check(app: tauri::AppHandle, id: String, checked: bool) {
    use tauri::menu::MenuItemKind;
    if let Some(menu) = app.menu() {
        if let Some(item) = menu.get(&id) {
            if let MenuItemKind::Check(check_item) = item {
                let _ = check_item.set_checked(checked);
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_photos,
            get_thumbnail,
            get_camera_volumes,
            import_to_photos,
            import_with_gps,
            delete_from_card,
            eject_volume,
            evict_thumbnail,
            clear_thumbnail_cache,
            check_ffmpeg,
            load_gpx,
            unload_gpx,
            unload_gpx_file,
            get_gpx_summary,
            get_gpx_summaries,
            match_photos_to_gpx,
            get_gpx_track,
            sync_menu_check
        ])
        .setup(|app| {
            let handle = app.handle();

            let app_menu = SubmenuBuilder::new(handle, "Photo Import")
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .item(&MenuItem::with_id(handle, "browse_folder", "Browse Folder...", true, Some("CmdOrCtrl+O"))?)
                .item(&MenuItem::with_id(handle, "load_gpx", "Load GPX...", true, Some("CmdOrCtrl+G"))?)
                .separator()
                .item(&MenuItem::with_id(handle, "import", "Import to Photos", true, Some("CmdOrCtrl+Return"))?)
                .separator()
                .item(&MenuItem::with_id(handle, "eject", "Eject SD Card", true, Some("CmdOrCtrl+E"))?)
                .separator()
                .item(&CheckMenuItem::with_id(handle, "auto_detect", "Auto-detect SD Card", true, true, None::<&str>)?)
                .separator()
                .item(&MenuItem::with_id(handle, "delete_focused", "Delete Focused", true, Some("CmdOrCtrl+Backspace"))?)
                .item(&MenuItem::with_id(handle, "delete_selected", "Delete Selected", true, Some("CmdOrCtrl+Shift+Backspace"))?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .separator()
                .item(&MenuItem::with_id(handle, "select_all_photos", "Select All Photos", true, Some("CmdOrCtrl+Shift+A"))?)
                .item(&MenuItem::with_id(handle, "deselect_all", "Deselect All", true, Some("CmdOrCtrl+D"))?)
                .build()?;

            let view_menu = SubmenuBuilder::new(handle, "View")
                .item(&CheckMenuItem::with_id(handle, "toggle_map", "Map View", true, false, Some("CmdOrCtrl+M"))?)
                .item(&CheckMenuItem::with_id(handle, "toggle_info", "Info Panel", true, false, Some("CmdOrCtrl+I"))?)
                .item(&CheckMenuItem::with_id(handle, "toggle_timeline", "Timeline", true, true, Some("CmdOrCtrl+T"))?)
                .item(&CheckMenuItem::with_id(handle, "group_bursts", "Group Bursts", true, true, Some("CmdOrCtrl+B"))?)
                .item(&MenuItem::with_id(handle, "reload", "Reload", true, Some("CmdOrCtrl+R"))?)
                .separator()
                .item(&MenuItem::with_id(handle, "zoom_in", "Zoom In", true, Some("CmdOrCtrl+="))?)
                .item(&MenuItem::with_id(handle, "zoom_out", "Zoom Out", true, Some("CmdOrCtrl+Minus"))?)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(handle, None)?)
                .build()?;

            let window_menu = SubmenuBuilder::new(handle, "Window")
                .minimize()
                .maximize()
                .separator()
                .close_window()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            volumes::start_volume_watcher(handle.clone());
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit("menu-event", event.id.0.as_str());
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
