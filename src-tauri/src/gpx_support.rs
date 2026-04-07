use chrono::{DateTime, NaiveDateTime, Utc};
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::sync::Mutex;
use time::OffsetDateTime;

static GPX_STATE: std::sync::LazyLock<Mutex<Vec<GpxData>>> =
    std::sync::LazyLock::new(|| Mutex::new(Vec::new()));

#[derive(Debug, Clone)]
struct TrackPoint {
    lat: f64,
    lon: f64,
    time: DateTime<Utc>,
}

#[derive(Debug, Clone)]
struct GpxData {
    points: Vec<TrackPoint>,
    summary: GpxSummary,
}

#[derive(Debug, Clone, Serialize)]
pub struct GpxSummary {
    pub point_count: usize,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub duration_secs: Option<f64>,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GpxMatch {
    pub lat: f64,
    pub lon: f64,
    pub source: &'static str, // "gpx"
}

pub fn load_gpx(path: &str) -> Result<GpxSummary, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read GPX: {e}"))?;
    let reader = std::io::BufReader::new(content.as_bytes());
    let gpx_data = gpx::read(reader).map_err(|e| format!("Failed to parse GPX: {e}"))?;

    let mut points = Vec::new();
    for track in &gpx_data.tracks {
        for segment in &track.segments {
            for pt in &segment.points {
                if let Some(time) = pt.time {
                    let odt: OffsetDateTime = time.into();
                    let chrono_time = DateTime::<Utc>::from_timestamp(
                        odt.unix_timestamp(),
                        odt.nanosecond(),
                    ).unwrap();
                    points.push(TrackPoint {
                        lat: pt.point().y(),
                        lon: pt.point().x(),
                        time: chrono_time,
                    });
                }
            }
        }
    }

    // Also parse waypoints and route points
    for wpt in &gpx_data.waypoints {
        if let Some(time) = wpt.time {
            let odt: OffsetDateTime = time.into();
            let chrono_time = DateTime::<Utc>::from_timestamp(
                odt.unix_timestamp(),
                odt.nanosecond(),
            ).unwrap();
            points.push(TrackPoint {
                lat: wpt.point().y(),
                lon: wpt.point().x(),
                time: chrono_time,
            });
        }
    }

    // Sort by time
    points.sort_by_key(|p| p.time);

    if points.is_empty() {
        return Err("No timestamped trackpoints found in GPX file".to_string());
    }

    let start = points.first().map(|p| p.time.to_rfc3339());
    let end = points.last().map(|p| p.time.to_rfc3339());
    let duration = match (points.first(), points.last()) {
        (Some(a), Some(b)) => Some((b.time - a.time).num_seconds() as f64),
        _ => None,
    };

    let filename: String = std::path::Path::new(path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into();

    let summary = GpxSummary {
        point_count: points.len(),
        start_time: start,
        end_time: end,
        duration_secs: duration,
        filename: filename.clone(),
    };

    let data = GpxData {
        points,
        summary: summary.clone(),
    };

    if let Ok(mut state) = GPX_STATE.lock() {
        // Don't add duplicate filenames
        state.retain(|d| d.summary.filename != filename);
        state.push(data);
    }

    Ok(summary)
}

pub fn unload_gpx_file(filename: &str) {
    if let Ok(mut state) = GPX_STATE.lock() {
        state.retain(|d| d.summary.filename != filename);
    }
}

pub fn unload_gpx() {
    if let Ok(mut state) = GPX_STATE.lock() {
        state.clear();
    }
}

pub fn get_gpx_summaries() -> Vec<GpxSummary> {
    GPX_STATE
        .lock()
        .ok()
        .map(|s| s.iter().map(|d| d.summary.clone()).collect())
        .unwrap_or_default()
}

pub fn get_gpx_summary() -> Option<GpxSummary> {
    get_gpx_summaries().into_iter().next()
}

/// Match photos to GPX trackpoints across all loaded files.
pub fn match_photos_to_gpx(
    photos: &[(String, String)],
    time_offset_secs: i64,
    max_gap_secs: f64,
) -> HashMap<String, GpxMatch> {
    let state = match GPX_STATE.lock() {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };

    if state.is_empty() {
        return HashMap::new();
    }

    // Merge all points from all files, sorted by time
    let mut all_points: Vec<&TrackPoint> = state.iter().flat_map(|d| &d.points).collect();
    all_points.sort_by_key(|p| p.time);

    if all_points.is_empty() {
        return HashMap::new();
    }

    let mut matches = HashMap::new();

    for (path, date_str) in photos {
        let photo_time = match parse_photo_time(date_str, time_offset_secs) {
            Some(t) => t,
            None => continue,
        };

        // Binary search for the insertion point
        let idx = all_points.partition_point(|p| p.time < photo_time);

        // Find the two bracketing points
        let (before, after) = match idx {
            0 => (None, all_points.first().copied()),
            i if i >= all_points.len() => (all_points.last().copied(), None),
            i => (Some(all_points[i - 1]), Some(all_points[i])),
        };

        let result = match (before, after) {
            (Some(b), Some(a)) => {
                let gap_b = (photo_time - b.time).num_milliseconds().unsigned_abs() as f64 / 1000.0;
                let gap_a = (a.time - photo_time).num_milliseconds().unsigned_abs() as f64 / 1000.0;
                if gap_b > max_gap_secs && gap_a > max_gap_secs {
                    continue;
                }
                // Interpolate
                let total = (a.time - b.time).num_milliseconds() as f64;
                if total.abs() < 1.0 {
                    (b.lat, b.lon)
                } else {
                    let t = (photo_time - b.time).num_milliseconds() as f64 / total;
                    let lat = b.lat + (a.lat - b.lat) * t;
                    let lon = b.lon + (a.lon - b.lon) * t;
                    (lat, lon)
                }
            }
            (Some(p), None) | (None, Some(p)) => {
                let gap =
                    (photo_time - p.time).num_milliseconds().unsigned_abs() as f64 / 1000.0;
                if gap > max_gap_secs {
                    continue;
                }
                (p.lat, p.lon)
            }
            _ => continue,
        };

        matches.insert(
            path.clone(),
            GpxMatch {
                lat: result.0,
                lon: result.1,
                source: "gpx",
            },
        );
    }

    matches
}

/// Get all GPX track points for map display (from all loaded files)
pub fn get_gpx_track() -> Vec<(f64, f64)> {
    GPX_STATE
        .lock()
        .ok()
        .map(|s| {
            s.iter()
                .flat_map(|d| d.points.iter().map(|p| (p.lat, p.lon)))
                .collect()
        })
        .unwrap_or_default()
}

fn parse_photo_time(date_str: &str, offset_secs: i64) -> Option<DateTime<Utc>> {
    // Try parsing as RFC3339 first (already has timezone info)
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        let adjusted = dt.with_timezone(&Utc) + chrono::Duration::seconds(offset_secs);
        return Some(adjusted);
    }

    // Naive datetime (no timezone) — EXIF dates are typically in camera's local time.
    // Use the system's local UTC offset to convert to UTC, then apply user offset on top.
    if let Ok(naive) = NaiveDateTime::parse_from_str(date_str, "%Y-%m-%dT%H:%M:%S") {
        let local_offset = *chrono::Local::now().offset();
        let dt = naive.and_local_timezone(local_offset).single()?;
        let adjusted = dt.with_timezone(&Utc) + chrono::Duration::seconds(offset_secs);
        return Some(adjusted);
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_photo_time_rfc3339() {
        let t = parse_photo_time("2026-04-05T14:30:00+00:00", 0);
        assert!(t.is_some());
    }

    #[test]
    fn test_parse_photo_time_naive() {
        let t = parse_photo_time("2026-04-05T14:30:00", 3600);
        assert!(t.is_some());
    }

    #[test]
    fn test_parse_photo_time_with_offset() {
        let t1 = parse_photo_time("2026-04-05T14:30:00+00:00", 0).unwrap();
        let t2 = parse_photo_time("2026-04-05T14:30:00+00:00", 3600).unwrap();
        assert_eq!((t2 - t1).num_seconds(), 3600);
    }
}
