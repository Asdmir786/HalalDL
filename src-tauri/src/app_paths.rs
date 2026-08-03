use std::fs;
use std::path::PathBuf;

use tauri::Manager;

pub const PORTABLE_MARKER_FILE: &str = "HalalDL.portable.json";
pub const PORTABLE_DATA_DIR: &str = "portable-data";
pub const STATE_DIR: &str = "state";
pub const BIN_DIR: &str = "bin";
pub const THUMBNAILS_DIR: &str = "thumbnails";
pub const ARCHIVE_DIR: &str = "download-archive";
pub const UPDATES_DIR: &str = "updates";
pub const CACHE_DIR: &str = "cache";
pub const YTDLP_CACHE_DIR: &str = "yt-dlp";
pub const MANAGED_TOOL_IDS: &[&str] = &["yt-dlp", "ffmpeg", "aria2", "deno"];

fn managed_tool_file_name(tool_id: &str) -> Option<&'static str> {
    match tool_id {
        "yt-dlp" => Some("yt-dlp.exe"),
        "ffmpeg" => Some("ffmpeg.exe"),
        "aria2" => Some("aria2c.exe"),
        "deno" => Some("deno.exe"),
        _ => None,
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub is_portable: bool,
    pub app_dir: String,
    pub data_dir: String,
    pub state_dir: String,
    pub bin_dir: String,
    pub thumbnails_dir: String,
    pub archive_dir: String,
    pub updates_dir: String,
    pub cache_dir: String,
    pub ytdlp_cache_dir: String,
    pub marker_path: String,
}

pub fn current_exe_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    exe.parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "Executable directory is unavailable".to_string())
}

pub fn portable_marker_path_for_app_dir(app_dir: &PathBuf) -> PathBuf {
    app_dir.join(PORTABLE_MARKER_FILE)
}

pub fn is_portable_layout(app_dir: &PathBuf) -> bool {
    portable_marker_path_for_app_dir(app_dir).exists()
}

pub fn resolve_paths(app_handle: &tauri::AppHandle) -> Result<AppPaths, String> {
    let app_dir = current_exe_dir()?;
    let is_portable = is_portable_layout(&app_dir);

    let data_dir = if is_portable {
        app_dir.join(PORTABLE_DATA_DIR)
    } else {
        app_handle
            .path()
            .app_data_dir()
            .map_err(|e: tauri::Error| e.to_string())?
    };

    let state_dir = data_dir.join(STATE_DIR);
    let bin_dir = data_dir.join(BIN_DIR);
    let thumbnails_dir = data_dir.join(THUMBNAILS_DIR);
    let archive_dir = data_dir.join(ARCHIVE_DIR);
    let updates_dir = data_dir.join(UPDATES_DIR);
    let cache_dir = data_dir.join(CACHE_DIR);
    let ytdlp_cache_dir = cache_dir.join(YTDLP_CACHE_DIR);
    let marker_path = portable_marker_path_for_app_dir(&app_dir);

    Ok(AppPaths {
        is_portable,
        app_dir: app_dir.to_string_lossy().to_string(),
        data_dir: data_dir.to_string_lossy().to_string(),
        state_dir: state_dir.to_string_lossy().to_string(),
        bin_dir: bin_dir.to_string_lossy().to_string(),
        thumbnails_dir: thumbnails_dir.to_string_lossy().to_string(),
        archive_dir: archive_dir.to_string_lossy().to_string(),
        updates_dir: updates_dir.to_string_lossy().to_string(),
        cache_dir: cache_dir.to_string_lossy().to_string(),
        ytdlp_cache_dir: ytdlp_cache_dir.to_string_lossy().to_string(),
        marker_path: marker_path.to_string_lossy().to_string(),
    })
}

pub fn ensure_app_dirs(app_handle: &tauri::AppHandle) -> Result<AppPaths, String> {
    let paths = resolve_paths(app_handle)?;
    for dir in [
        &paths.data_dir,
        &paths.state_dir,
        &paths.bin_dir,
        &paths.thumbnails_dir,
        &paths.archive_dir,
        &paths.updates_dir,
        &paths.cache_dir,
        &paths.ytdlp_cache_dir,
    ] {
        fs::create_dir_all(dir).map_err(|e| format!("Failed to create {}: {}", dir, e))?;
    }
    Ok(paths)
}

fn remove_dir_if_exists(path: &PathBuf) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }
    fs::remove_dir_all(path).map_err(|e| format!("Failed to remove {}: {}", path.display(), e))?;
    Ok(true)
}

/// Clears HalalDL-managed and known yt-dlp cache folders (not config).
#[tauri::command]
pub fn clear_ytdlp_cache(app_handle: tauri::AppHandle) -> Result<String, String> {
    let paths = ensure_app_dirs(&app_handle)?;
    let mut cleared = Vec::new();

    let managed = PathBuf::from(&paths.ytdlp_cache_dir);
    if remove_dir_if_exists(&managed)? {
        cleared.push(format!("app cache ({})", managed.display()));
        fs::create_dir_all(&managed)
            .map_err(|e| format!("Failed to recreate {}: {}", managed.display(), e))?;
    }

    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        // Windows yt-dlp cache root (config lives under APPDATA, not here).
        let candidate = PathBuf::from(local).join("yt-dlp");
        if remove_dir_if_exists(&candidate)? {
            cleared.push(format!("LocalAppData cache ({})", candidate.display()));
        }
    }

    if let Ok(home) = std::env::var("USERPROFILE") {
        let candidate = PathBuf::from(home).join(".cache").join("yt-dlp");
        if remove_dir_if_exists(&candidate)? {
            cleared.push(format!("user cache ({})", candidate.display()));
        }
    }

    if cleared.is_empty() {
        Ok("No yt-dlp cache folders were found".to_string())
    } else {
        Ok(format!("Cleared {}", cleared.join("; ")))
    }
}

#[tauri::command]
pub fn get_missing_app_managed_tools(
    app_handle: tauri::AppHandle,
    tool_ids: Option<Vec<String>>,
) -> Result<Vec<String>, String> {
    let paths = ensure_app_dirs(&app_handle)?;
    let bin_dir = PathBuf::from(&paths.bin_dir);
    let requested = tool_ids.unwrap_or_else(|| {
        MANAGED_TOOL_IDS
            .iter()
            .map(|tool_id| (*tool_id).to_string())
            .collect()
    });

    let mut missing = Vec::new();

    for tool_id in requested {
        let Some(file_name) = managed_tool_file_name(&tool_id) else {
            return Err(format!("Unsupported managed tool id: {}", tool_id));
        };

        if !bin_dir.join(file_name).exists() {
            missing.push(tool_id);
        }
    }

    Ok(missing)
}

#[tauri::command]
pub fn resolve_app_paths(app_handle: tauri::AppHandle) -> Result<AppPaths, String> {
    ensure_app_dirs(&app_handle)
}
