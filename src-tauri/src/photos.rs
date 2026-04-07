use base64::Engine;
use exif::{In, Tag};
use image::imageops::FilterType;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::BufReader;
use std::path::Path;
use std::sync::Mutex;

static THUMBNAIL_CACHE: std::sync::LazyLock<Mutex<HashMap<String, String>>> =
    std::sync::LazyLock::new(|| Mutex::new(HashMap::new()));

const THUMBNAIL_WIDTH: u32 = 400;

#[derive(Debug, Clone, Serialize)]
pub struct PhotoMeta {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub date: String,
    pub media_type: &'static str,
    // Photo EXIF metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub camera: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lens: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focal_length: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aperture: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shutter_speed: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iso: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub orientation: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latitude: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub longitude: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rating: Option<u8>,
    // Video metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps_num: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
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
        } else if let Some(media_type) = classify_media(&path) {
            if let Ok(meta) = fs::metadata(&path) {
                let file_date = meta
                    .modified()
                    .ok()
                    .and_then(|t| {
                        let datetime: chrono::DateTime<chrono::Utc> = t.into();
                        Some(datetime.to_rfc3339())
                    })
                    .unwrap_or_default();

                let path_str: String = path.to_string_lossy().into();

                let mut photo_meta = PhotoMeta {
                    name: path.file_name().unwrap_or_default().to_string_lossy().into(),
                    path: path_str.clone(),
                    size: meta.len(),
                    date: file_date,
                    media_type,
                    camera: None,
                    lens: None,
                    focal_length: None,
                    aperture: None,
                    shutter_speed: None,
                    iso: None,
                    width: None,
                    height: None,
                    orientation: None,
                    latitude: None,
                    longitude: None,
                    rating: None,
                    duration: None,
                    resolution: None,
                    fps: None,
                    fps_num: None,
                    codec: None,
                };

                if media_type == "photo" {
                    read_exif_metadata(&path_str, &mut photo_meta);
                } else {
                    read_video_metadata(&path_str, &mut photo_meta);
                }

                photos.push(photo_meta);
            }
        }
    }
}

fn read_exif_metadata(path: &str, meta: &mut PhotoMeta) {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return,
    };
    let mut reader = BufReader::new(file);
    let exif = match exif::Reader::new().read_from_container(&mut reader) {
        Ok(e) => e,
        Err(_) => return,
    };

    // Camera make + model
    let make = exif_string(&exif, Tag::Make);
    let model = exif_string(&exif, Tag::Model);
    meta.camera = match (make, model) {
        (Some(make), Some(model)) => {
            // Many cameras include make in model string, avoid duplication
            if model.to_lowercase().starts_with(&make.to_lowercase()) {
                Some(model)
            } else {
                Some(format!("{make} {model}"))
            }
        }
        (None, Some(model)) => Some(model),
        (Some(make), None) => Some(make),
        _ => None,
    };

    // Lens
    meta.lens = exif_string(&exif, Tag::LensModel);

    // Focal length
    if let Some(field) = exif.get_field(Tag::FocalLength, In::PRIMARY) {
        if let exif::Value::Rational(ref v) = field.value {
            if let Some(r) = v.first() {
                let mm = r.num as f64 / r.denom as f64;
                meta.focal_length = Some(format!("{mm:.0}mm"));
            }
        }
    }

    // Aperture (FNumber)
    if let Some(field) = exif.get_field(Tag::FNumber, In::PRIMARY) {
        if let exif::Value::Rational(ref v) = field.value {
            if let Some(r) = v.first() {
                let f = r.num as f64 / r.denom as f64;
                meta.aperture = if f == f.floor() {
                    Some(format!("f/{f:.0}"))
                } else {
                    Some(format!("f/{f:.1}"))
                };
            }
        }
    }

    // Shutter speed (ExposureTime)
    if let Some(field) = exif.get_field(Tag::ExposureTime, In::PRIMARY) {
        if let exif::Value::Rational(ref v) = field.value {
            if let Some(r) = v.first() {
                let secs = r.num as f64 / r.denom as f64;
                meta.shutter_speed = if secs >= 1.0 {
                    Some(format!("{secs:.1}s"))
                } else {
                    let denom = (1.0 / secs).round() as u64;
                    Some(format!("1/{denom}"))
                };
            }
        }
    }

    // ISO
    if let Some(field) = exif.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
        meta.iso = Some(field.display_value().to_string());
    }

    // Dimensions
    if let Some(field) = exif.get_field(Tag::PixelXDimension, In::PRIMARY) {
        if let Some(w) = exif_u32(field) {
            meta.width = Some(w);
        }
    }
    if let Some(field) = exif.get_field(Tag::PixelYDimension, In::PRIMARY) {
        if let Some(h) = exif_u32(field) {
            meta.height = Some(h);
        }
    }

    // Capture date (DateTimeOriginal) — prefer over file modified time
    if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
        let date_str = field.display_value().to_string().replace('"', "");
        // EXIF dates are "2026:04:05 14:30:00" — convert to ISO 8601
        if date_str.len() >= 19 {
            let iso = format!(
                "{}-{}-{}T{}",
                &date_str[0..4],
                &date_str[5..7],
                &date_str[8..10],
                &date_str[11..19]
            );
            meta.date = iso;
        }
    }

    // Orientation
    if let Some(field) = exif.get_field(Tag::Orientation, In::PRIMARY) {
        if let Some(v) = exif_u32(field) {
            meta.orientation = Some(v as u16);
        }
    }

    // GPS
    let lat = read_gps_coord(&exif, Tag::GPSLatitude, Tag::GPSLatitudeRef);
    let lon = read_gps_coord(&exif, Tag::GPSLongitude, Tag::GPSLongitudeRef);
    if let (Some(lat), Some(lon)) = (lat, lon) {
        meta.latitude = Some(lat);
        meta.longitude = Some(lon);
    }

    // Rating (0-5) — IFD tag 0x4746 (Windows Rating) or 0x4749 (RatingPercent)
    // Not all cameras write this, but some do (and Lightroom/Bridge set it)
    for field in exif.fields() {
        if field.ifd_num == In::PRIMARY {
            let tag_num = field.tag.number();
            if tag_num == 0x4746 {
                if let Some(v) = exif_u32(field) {
                    if v <= 5 {
                        meta.rating = Some(v as u8);
                    }
                }
                break;
            }
        }
    }
}

fn exif_string(exif: &exif::Exif, tag: Tag) -> Option<String> {
    exif.get_field(tag, In::PRIMARY).and_then(|f| {
        let raw = f.display_value().to_string();
        // EXIF may produce multi-value strings like: "value1", ""
        // Take the first non-empty quoted value, or the whole trimmed string
        let cleaned = raw
            .split(',')
            .map(|s| s.trim().trim_matches('"').trim())
            .find(|s| !s.is_empty())?
            .to_string();
        if cleaned.is_empty() { None } else { Some(cleaned) }
    })
}

fn exif_u32(field: &exif::Field) -> Option<u32> {
    match &field.value {
        exif::Value::Long(v) => v.first().copied(),
        exif::Value::Short(v) => v.first().map(|&x| x as u32),
        _ => None,
    }
}

fn read_gps_coord(exif: &exif::Exif, coord_tag: Tag, ref_tag: Tag) -> Option<f64> {
    let field = exif.get_field(coord_tag, In::PRIMARY)?;
    if let exif::Value::Rational(ref vals) = field.value {
        if vals.len() >= 3 {
            let deg = vals[0].num as f64 / vals[0].denom as f64;
            let min = vals[1].num as f64 / vals[1].denom as f64;
            let sec = vals[2].num as f64 / vals[2].denom as f64;
            let mut coord = deg + min / 60.0 + sec / 3600.0;

            if let Some(ref_field) = exif.get_field(ref_tag, In::PRIMARY) {
                let ref_str = ref_field.display_value().to_string();
                if ref_str.contains('S') || ref_str.contains('W') {
                    coord = -coord;
                }
            }
            return Some(coord);
        }
    }
    None
}

fn read_video_metadata(path: &str, meta: &mut PhotoMeta) {
    let output = match std::process::Command::new(crate::resolve_tool("ffprobe"))
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output()
    {
        Ok(o) if o.status.success() => o,
        _ => return,
    };

    let json: serde_json::Value = match serde_json::from_slice(&output.stdout) {
        Ok(v) => v,
        Err(_) => return,
    };

    // Duration from format
    if let Some(dur) = json["format"]["duration"].as_str() {
        if let Ok(d) = dur.parse::<f64>() {
            meta.duration = Some(d);
        }
    }

    // Creation time from format tags — prefer over file date
    if let Some(ct) = json["format"]["tags"]["creation_time"].as_str() {
        // Already ISO 8601 typically
        meta.date = ct.to_string();
    }

    // Find video stream
    if let Some(streams) = json["streams"].as_array() {
        for stream in streams {
            if stream["codec_type"].as_str() == Some("video") {
                // Resolution
                let w = stream["width"].as_u64();
                let h = stream["height"].as_u64();
                if let (Some(w), Some(h)) = (w, h) {
                    meta.width = Some(w as u32);
                    meta.height = Some(h as u32);
                    meta.resolution = Some(match h {
                        2160.. => format!("4K ({w}x{h})"),
                        1080..=2159 => format!("1080p ({w}x{h})"),
                        720..=1079 => format!("720p ({w}x{h})"),
                        _ => format!("{w}x{h}"),
                    });
                }

                // FPS
                if let Some(fps_str) = stream["r_frame_rate"].as_str() {
                    if let Some((num, den)) = fps_str.split_once('/') {
                        if let (Ok(n), Ok(d)) = (num.parse::<f64>(), den.parse::<f64>()) {
                            if d > 0.0 {
                                let fps = n / d;
                                meta.fps = Some(format!("{fps:.0}fps"));
                                meta.fps_num = Some(fps);
                            }
                        }
                    }
                }

                // Codec
                if let Some(codec) = stream["codec_name"].as_str() {
                    meta.codec = Some(match codec {
                        "h264" => "H.264".to_string(),
                        "hevc" | "h265" => "H.265".to_string(),
                        "prores" => "ProRes".to_string(),
                        "av1" => "AV1".to_string(),
                        "vp9" => "VP9".to_string(),
                        other => other.to_uppercase(),
                    });
                }

                break;
            }
        }
    }
}

fn read_orientation(path: &str) -> u16 {
    let file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return 1,
    };
    let mut reader = BufReader::new(file);
    let exif = match exif::Reader::new().read_from_container(&mut reader) {
        Ok(e) => e,
        Err(_) => return 1,
    };
    exif.get_field(Tag::Orientation, In::PRIMARY)
        .and_then(|f| exif_u32(f))
        .map(|v| v as u16)
        .unwrap_or(1)
}

fn apply_orientation(img: image::DynamicImage, orientation: u16) -> image::DynamicImage {
    match orientation {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        6 => img.rotate90(),
        7 => img.rotate270().fliph(),
        8 => img.rotate270(),
        _ => img, // 1 = normal
    }
}

fn resize_and_encode(img: image::DynamicImage) -> Result<String, String> {
    let resized = img.resize(THUMBNAIL_WIDTH, u32::MAX, FilterType::Triangle);
    let mut buf = std::io::Cursor::new(Vec::new());
    resized
        .write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode thumbnail: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(buf.into_inner()))
}

pub fn get_thumbnail(path: &str) -> Result<String, String> {
    // Check cache first
    {
        let cache = THUMBNAIL_CACHE.lock().map_err(|e| e.to_string())?;
        if let Some(cached) = cache.get(path) {
            return Ok(cached.clone());
        }
    }

    let b64 = if is_video(path) {
        let img = extract_video_frame(path)?;
        resize_and_encode(img)?
    } else {
        // Try embedded EXIF thumbnail first (usually already oriented)
        match extract_exif_thumbnail(path) {
            Some(b64) => b64,
            None => {
                let orientation = read_orientation(path);
                let img = image::open(path)
                    .map_err(|e| format!("Failed to open image: {e}"))?;
                let img = apply_orientation(img, orientation);
                resize_and_encode(img)?
            }
        }
    };

    // Cache and return
    let mut cache = THUMBNAIL_CACHE.lock().map_err(|e| e.to_string())?;
    cache.insert(path.to_string(), b64.clone());
    Ok(b64)
}

fn extract_exif_thumbnail(path: &str) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;

    // EXIF stores thumbnails in the 1st IFD (THUMBNAIL)
    for field in exif.fields() {
        if field.tag == Tag::JPEGInterchangeFormat && field.ifd_num == In::THUMBNAIL {
            // We found a thumbnail pointer — read the raw thumbnail bytes
            let file2 = fs::File::open(path).ok()?;
            let mut reader2 = BufReader::new(file2);
            let exif2 = exif::Reader::new().read_from_container(&mut reader2).ok()?;
            let buf = exif2.buf();

            if let Some(offset_field) =
                exif2.get_field(Tag::JPEGInterchangeFormat, In::THUMBNAIL)
            {
                if let Some(length_field) =
                    exif2.get_field(Tag::JPEGInterchangeFormatLength, In::THUMBNAIL)
                {
                    let offset = exif_u32(offset_field)? as usize;
                    let length = exif_u32(length_field)? as usize;
                    if offset + length <= buf.len() {
                        let thumb_bytes = &buf[offset..offset + length];
                        return Some(
                            base64::engine::general_purpose::STANDARD.encode(thumb_bytes),
                        );
                    }
                }
            }
            break;
        }
    }
    None
}

fn extract_video_frame(path: &str) -> Result<image::DynamicImage, String> {
    let tmp_dir = std::env::temp_dir().join("photo-import-thumbs");
    fs::create_dir_all(&tmp_dir).map_err(|e| format!("Failed to create temp dir: {e}"))?;

    let hash = {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        path.hash(&mut h);
        h.finish()
    };
    let frame_path = tmp_dir.join(format!("{hash}.jpg"));

    let output = std::process::Command::new(crate::resolve_tool("ffmpeg"))
        .args([
            "-i", path, "-ss", "0.5", "-frames:v", "1", "-y",
            frame_path.to_str().unwrap(),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .output()
        .map_err(|e| format!("ffmpeg not found or failed to run: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg failed: {stderr}"));
    }

    let img =
        image::open(&frame_path).map_err(|e| format!("Failed to open extracted frame: {e}"))?;
    let _ = fs::remove_file(&frame_path);
    Ok(img)
}

pub fn evict_thumbnail(path: &str) {
    if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
        cache.remove(path);
    }
}

pub fn clear_thumbnail_cache() {
    if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
        cache.clear();
    }
}

fn classify_media(path: &Path) -> Option<&'static str> {
    let ext = path.extension()?.to_str()?.to_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "heic" | "heif" | "tiff" | "tif" | "bmp" | "webp"
        | "cr2" | "cr3" | "nef" | "arw" | "raf" | "dng" | "orf" | "rw2" | "pef" | "srw" => {
            Some("photo")
        }
        "mp4" | "mov" | "avi" | "m4v" | "mts" | "m2ts" | "mkv" | "3gp" => Some("video"),
        _ => None,
    }
}

fn is_raw(path: &str) -> bool {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    matches!(ext.as_str(), "cr2" | "cr3" | "nef" | "arw" | "raf" | "dng" | "orf" | "rw2" | "pef" | "srw")
}

fn is_video(path: &str) -> bool {
    classify_media(Path::new(path)) == Some("video")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{self, File};
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_scan_dcim_finds_media() {
        let tmp = tempdir().unwrap();
        let dcim = tmp.path().join("DCIM").join("100CANON");
        fs::create_dir_all(&dcim).unwrap();

        File::create(dcim.join("IMG_0001.JPG"))
            .unwrap()
            .write_all(b"fake jpeg")
            .unwrap();
        File::create(dcim.join("IMG_0002.jpg"))
            .unwrap()
            .write_all(b"fake jpeg")
            .unwrap();
        File::create(dcim.join("VID_0003.MP4"))
            .unwrap()
            .write_all(b"fake video")
            .unwrap();
        File::create(dcim.join("readme.txt"))
            .unwrap()
            .write_all(b"not media")
            .unwrap();

        let photos = scan_dcim(tmp.path().to_str().unwrap());
        assert_eq!(photos.len(), 3);
        assert_eq!(photos[0].name, "IMG_0001.JPG");
        assert_eq!(photos[0].media_type, "photo");
        assert_eq!(photos[1].name, "IMG_0002.jpg");
        assert_eq!(photos[2].name, "VID_0003.MP4");
        assert_eq!(photos[2].media_type, "video");
    }

    #[test]
    fn test_scan_dcim_no_dcim_folder() {
        let tmp = tempdir().unwrap();
        let photos = scan_dcim(tmp.path().to_str().unwrap());
        assert_eq!(photos.len(), 0);
    }

    #[test]
    fn test_get_thumbnail_returns_base64() {
        let tmp = tempdir().unwrap();
        let img_path = tmp.path().join("test.jpg");

        let img = image::RgbImage::new(100, 100);
        img.save(&img_path).unwrap();

        let result = get_thumbnail(img_path.to_str().unwrap());
        assert!(result.is_ok());
        let b64 = result.unwrap();
        assert!(!b64.is_empty());
        let decoded = base64::engine::general_purpose::STANDARD.decode(&b64).unwrap();
        assert!(!decoded.is_empty());
    }

    #[test]
    fn test_classify_media() {
        assert_eq!(classify_media(Path::new("photo.jpg")), Some("photo"));
        assert_eq!(classify_media(Path::new("photo.JPEG")), Some("photo"));
        assert_eq!(classify_media(Path::new("photo.PNG")), Some("photo"));
        assert_eq!(classify_media(Path::new("photo.heic")), Some("photo"));
        assert_eq!(classify_media(Path::new("video.mp4")), Some("video"));
        assert_eq!(classify_media(Path::new("video.MOV")), Some("video"));
        assert_eq!(classify_media(Path::new("video.mts")), Some("video"));
        assert_eq!(classify_media(Path::new("readme.txt")), None);
    }
}
