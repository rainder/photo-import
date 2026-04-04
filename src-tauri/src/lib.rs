mod photos;

use photos::PhotoMeta;

#[tauri::command]
fn list_photos(volume_path: String) -> Vec<PhotoMeta> {
    photos::scan_dcim(&volume_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_photos])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
