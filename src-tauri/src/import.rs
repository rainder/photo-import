use serde::Serialize;
use std::fs;
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

pub fn import_to_photos(paths: &[String]) -> ImportResult {
    let mut succeeded = Vec::new();
    let mut failed = Vec::new();

    for path in paths {
        let script = format!(
            r#"tell application "Photos"
    activate
    import POSIX file "{}"
end tell"#,
            path.replace('\\', "\\\\").replace('"', "\\\"")
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match output {
            Ok(out) if out.status.success() => {
                succeeded.push(path.clone());
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                failed.push(ImportError {
                    path: path.clone(),
                    error: stderr,
                });
            }
            Err(e) => {
                failed.push(ImportError {
                    path: path.clone(),
                    error: e.to_string(),
                });
            }
        }
    }

    ImportResult { succeeded, failed }
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
