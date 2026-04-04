use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct PhotoMeta {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub date: String,
}

pub fn scan_dcim(volume_path: &str) -> Vec<PhotoMeta> {
    let dcim_path = Path::new(volume_path).join("DCIM");
    if !dcim_path.exists() {
        return vec![];
    }
    let mut photos = Vec::new();
    scan_dir_recursive(&dcim_path, &mut photos);
    photos.sort_by(|a, b| a.name.cmp(&b.name));
    photos
}

fn scan_dir_recursive(dir: &Path, photos: &mut Vec<PhotoMeta>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            scan_dir_recursive(&path, photos);
        } else if is_jpeg(&path) {
            if let Ok(meta) = fs::metadata(&path) {
                let date = meta
                    .modified()
                    .ok()
                    .and_then(|t| {
                        let datetime: chrono::DateTime<chrono::Utc> = t.into();
                        Some(datetime.to_rfc3339())
                    })
                    .unwrap_or_default();

                photos.push(PhotoMeta {
                    name: path.file_name().unwrap_or_default().to_string_lossy().into(),
                    path: path.to_string_lossy().into(),
                    size: meta.len(),
                    date,
                });
            }
        }
    }
}

fn is_jpeg(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(ext.to_lowercase().as_str(), "jpg" | "jpeg"),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_scan_dcim_finds_jpegs() {
        let tmp = tempdir().unwrap();
        let dcim = tmp.path().join("DCIM").join("100CANON");
        fs::create_dir_all(&dcim).unwrap();

        File::create(dcim.join("IMG_0001.JPG")).unwrap().write_all(b"fake jpeg").unwrap();
        File::create(dcim.join("IMG_0002.jpg")).unwrap().write_all(b"fake jpeg").unwrap();
        File::create(dcim.join("readme.txt")).unwrap().write_all(b"not a photo").unwrap();

        let photos = scan_dcim(tmp.path().to_str().unwrap());
        assert_eq!(photos.len(), 2);
        assert_eq!(photos[0].name, "IMG_0001.JPG");
        assert_eq!(photos[1].name, "IMG_0002.jpg");
    }

    #[test]
    fn test_scan_dcim_no_dcim_folder() {
        let tmp = tempdir().unwrap();
        let photos = scan_dcim(tmp.path().to_str().unwrap());
        assert_eq!(photos.len(), 0);
    }
}
