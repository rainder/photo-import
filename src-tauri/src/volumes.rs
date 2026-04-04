use serde::Serialize;
use std::fs;
use std::path::Path;

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
pub struct CameraVolume {
    pub name: String,
    pub path: String,
}

/// Check if a volume path contains a DCIM folder (camera card indicator)
pub fn has_dcim(volume_path: &str) -> bool {
    Path::new(volume_path).join("DCIM").is_dir()
}

/// List currently mounted volumes that contain a DCIM folder
pub fn list_camera_volumes() -> Vec<CameraVolume> {
    let volumes_dir = Path::new("/Volumes");
    let mut result = Vec::new();

    if let Ok(entries) = fs::read_dir(volumes_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && has_dcim(path.to_str().unwrap_or("")) {
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into();
                result.push(CameraVolume {
                    name,
                    path: path.to_string_lossy().into(),
                });
            }
        }
    }

    result
}

pub fn start_volume_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match RecommendedWatcher::new(tx, notify::Config::default()) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create volume watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(Path::new("/Volumes"), RecursiveMode::NonRecursive) {
            eprintln!("Failed to watch /Volumes: {}", e);
            return;
        }

        // Emit initial state
        for vol in list_camera_volumes() {
            let _ = app.emit("sd-card-mounted", &vol);
        }

        for event in rx {
            match event {
                Ok(Event {
                    kind: EventKind::Create(_),
                    paths,
                    ..
                }) => {
                    for path in &paths {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        if let Some(path_str) = path.to_str() {
                            if has_dcim(path_str) {
                                let vol = CameraVolume {
                                    name: path
                                        .file_name()
                                        .unwrap_or_default()
                                        .to_string_lossy()
                                        .into(),
                                    path: path_str.to_string(),
                                };
                                let _ = app.emit("sd-card-mounted", &vol);
                            }
                        }
                    }
                }
                Ok(Event {
                    kind: EventKind::Remove(_),
                    paths,
                    ..
                }) => {
                    for path in &paths {
                        if let Some(name) = path.file_name() {
                            let _ = app.emit(
                                "sd-card-unmounted",
                                name.to_string_lossy().to_string(),
                            );
                        }
                    }
                }
                _ => {}
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_has_dcim_true() {
        let tmp = tempdir().unwrap();
        fs::create_dir(tmp.path().join("DCIM")).unwrap();
        assert!(has_dcim(tmp.path().to_str().unwrap()));
    }

    #[test]
    fn test_has_dcim_false() {
        let tmp = tempdir().unwrap();
        assert!(!has_dcim(tmp.path().to_str().unwrap()));
    }
}
