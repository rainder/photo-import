use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<ImportError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ImportError {
    pub path: String,
    pub error: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ImportItem {
    pub path: String,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
}

pub fn import_to_photos(paths: &[String]) -> ImportResult {
    let items: Vec<ImportItem> = paths
        .iter()
        .map(|p| ImportItem {
            path: p.clone(),
            lat: None,
            lon: None,
        })
        .collect();
    import_to_photos_with_gps(&items)
}

pub fn import_to_photos_with_gps(items: &[ImportItem]) -> ImportResult {
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();
    let has_exiftool = check_exiftool();
    let mut temp_files: Vec<String> = Vec::new();

    // Clean up any leftover temp files from a previous import
    let tmp_dir = std::env::temp_dir().join("photo-import-gps");
    let _ = fs::remove_dir_all(&tmp_dir);

    for item in items {
        // If we have GPS data and exiftool, write GPS to a temp copy then import that
        let import_path = if item.lat.is_some() && item.lon.is_some() && has_exiftool {
            match prepare_gps_copy(&item.path, item.lat.unwrap(), item.lon.unwrap()) {
                Ok(tmp) => {
                    temp_files.push(tmp.clone());
                    tmp
                }
                Err(e) => {
                    // Fall back to importing without GPS
                    eprintln!("GPS write failed, importing without GPS: {e}");
                    item.path.clone()
                }
            }
        } else {
            item.path.clone()
        };

        let script = format!(
            r#"tell application "Photos"
    activate
    import POSIX file "{}"
end tell"#,
            import_path.replace('\\', "\\\\").replace('"', "\\\"")
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match output {
            Ok(out) if out.status.success() => {
                succeeded.push(item.path.clone());
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                failed.push(ImportError {
                    path: item.path.clone(),
                    error: stderr,
                });
            }
            Err(e) => {
                failed.push(ImportError {
                    path: item.path.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    // Clean up temp files after a delay to let Photos.app finish reading them
    if !temp_files.is_empty() {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_secs(30));
            for f in &temp_files {
                let _ = fs::remove_file(f);
            }
            let _ = fs::remove_dir_all(&tmp_dir);
        });
    }

    ImportResult { succeeded, failed }
}

fn check_exiftool() -> bool {
    Command::new(crate::resolve_tool("exiftool"))
        .arg("-ver")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
}

fn prepare_gps_copy(path: &str, lat: f64, lon: f64) -> Result<String, String> {
    let src = Path::new(path);
    let ext = src
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let stem = src
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let tmp_dir = std::env::temp_dir().join("photo-import-gps");
    fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    let tmp_path = tmp_dir.join(format!("{stem}_gps.{ext}"));
    fs::copy(path, &tmp_path).map_err(|e| format!("Copy failed: {e}"))?;

    let tmp_str = tmp_path.to_string_lossy().to_string();

    // Use exiftool to write GPS coordinates
    let lat_ref = if lat >= 0.0 { "N" } else { "S" };
    let lon_ref = if lon >= 0.0 { "E" } else { "W" };

    let output = Command::new(crate::resolve_tool("exiftool"))
        .arg("-overwrite_original")
        .arg(format!("-GPSLatitude={}", lat.abs()))
        .arg(format!("-GPSLatitudeRef={lat_ref}"))
        .arg(format!("-GPSLongitude={}", lon.abs()))
        .arg(format!("-GPSLongitudeRef={lon_ref}"))
        .arg(&tmp_str)
        .output()
        .map_err(|e| format!("exiftool failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("exiftool error: {stderr}"));
    }

    Ok(tmp_str)
}

pub fn delete_from_card(paths: &[String]) -> DeleteResult {
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for path in paths {
        match fs::remove_file(path) {
            Ok(()) => succeeded.push(path.clone()),
            Err(e) => failed.push(ImportError {
                path: path.clone(),
                error: e.to_string(),
            }),
        }
    }

    DeleteResult { succeeded, failed }
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteResult {
    pub succeeded: Vec<String>,
    pub failed: Vec<ImportError>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_delete_from_card_removes_files() {
        let tmp = tempdir().unwrap();
        let file_path = tmp.path().join("IMG_0001.JPG");
        File::create(&file_path).unwrap().write_all(b"data").unwrap();

        let paths = vec![file_path.to_str().unwrap().to_string()];
        let result = delete_from_card(&paths);

        assert_eq!(result.succeeded.len(), 1);
        assert_eq!(result.failed.len(), 0);
        assert!(!file_path.exists());
    }

    #[test]
    fn test_delete_nonexistent_file_fails() {
        let result = delete_from_card(&["/nonexistent/file.jpg".to_string()]);
        assert_eq!(result.succeeded.len(), 0);
        assert_eq!(result.failed.len(), 1);
    }
}
