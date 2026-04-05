mod import;
mod photos;
mod volumes;

use import::{DeleteResult, ImportResult};
use photos::PhotoMeta;
use volumes::CameraVolume;

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
fn eject_volume(volume_path: String) -> Result<(), String> {
    volumes::eject_volume(&volume_path)
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
            delete_from_card,
            eject_volume
        ])
        .setup(|app| {
            volumes::start_volume_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
