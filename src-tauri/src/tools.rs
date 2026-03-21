use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashSet;
use tauri::Manager;

use crate::fs_utils::{temp_path_for, safe_replace_with_backup};
use crate::download::{download_to_temp, emit_progress, resolve_latest_aria2_zip_url};
use crate::extract::extract_from_zip;

/// Resolve the full system path of a tool using `where` (Windows).
#[tauri::command]
pub fn resolve_system_tool_path(tool: String) -> Result<Option<String>, String> {
    let bin_name = match tool.as_str() {
        "yt-dlp" => "yt-dlp.exe",
        "ffmpeg" => "ffmpeg.exe",
        "aria2"  => "aria2c.exe",
        "deno"   => "deno.exe",
        _ => return Err(format!("Unknown tool: {}", tool)),
    };

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        let output = std::process::Command::new("where")
            .arg(bin_name)
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| format!("Failed to run 'where': {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let first_path = stdout.lines().next().unwrap_or("").trim();
            if !first_path.is_empty() {
                return Ok(Some(first_path.to_string()));
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = std::process::Command::new("which")
            .arg(bin_name.trim_end_matches(".exe"))
            .output()
            .map_err(|e| format!("Failed to run 'which': {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let first_path = stdout.lines().next().unwrap_or("").trim();
            if !first_path.is_empty() {
                return Ok(Some(first_path.to_string()));
            }
        }
    }

    Ok(None)
}

async fn download_tool_payload(
    app_handle: &tauri::AppHandle,
    tool: &str,
    url: &str,
    dest_path: &PathBuf,
) -> Result<(), String> {
    let temp = download_to_temp(app_handle, tool, url, dest_path).await?;
    safe_replace_with_backup(dest_path, &temp)?;
    Ok(())
}

async fn download_ytdlp(app_handle: &tauri::AppHandle, dest: &PathBuf, is_nightly: bool) -> Result<(), String> {
    let url = if is_nightly {
        "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe"
    } else {
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    };
    let dest_file = dest.join("yt-dlp.exe");
    download_tool_payload(app_handle, "yt-dlp", url, &dest_file).await
}

async fn download_ffmpeg(app_handle: &tauri::AppHandle, dest: &PathBuf, variant: Option<String>, is_nightly: bool) -> Result<(), String> {
    let _ = variant;
    let _ = is_nightly;

    // Gyan only publishes an official ZIP for the stable Essentials build.
    // Use that package for app-managed installs so FFmpeg no longer depends on 7z extraction.
    let url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
    let zip_path = dest.join("ffmpeg-update.zip");
    download_tool_payload(app_handle, "ffmpeg", url, &zip_path).await?;
    emit_progress(app_handle, "ffmpeg", 99.0, "Extracting ffmpeg.exe, ffprobe.exe from zip...");
    let extracted = extract_from_zip(app_handle, "ffmpeg", &zip_path, dest, vec!["ffmpeg.exe", "ffprobe.exe"])?;
    emit_progress(app_handle, "ffmpeg", 100.0, &format!("Extracted: {}", extracted.join(", ")));
    if let Err(e) = fs::remove_file(&zip_path) {
        eprintln!("[tools] Warning: failed to clean up {:?}: {}", zip_path, e);
    }
    Ok(())
}

async fn download_aria2(app_handle: &tauri::AppHandle, dest: &PathBuf) -> Result<(), String> {
    let url = match resolve_latest_aria2_zip_url(app_handle).await {
        Ok(u) => u,
        Err(_) => "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip".to_string(),
    };
    let zip_path = dest.join("aria2-update.zip");
    download_tool_payload(app_handle, "aria2", &url, &zip_path).await?;
    emit_progress(app_handle, "aria2", 99.0, "Extracting aria2c.exe...");
    let extracted = extract_from_zip(app_handle, "aria2", &zip_path, dest, vec!["aria2c.exe"])?;
    emit_progress(app_handle, "aria2", 100.0, &format!("Extracted: {}", extracted.join(", ")));
    if let Err(e) = fs::remove_file(&zip_path) {
        eprintln!("[tools] Warning: failed to clean up {:?}: {}", zip_path, e);
    }
    Ok(())
}

async fn download_deno(app_handle: &tauri::AppHandle, dest: &PathBuf) -> Result<(), String> {
    let url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
    let zip_path = dest.join("deno-update.zip");
    download_tool_payload(app_handle, "deno", url, &zip_path).await?;
    emit_progress(app_handle, "deno", 99.0, "Extracting deno.exe...");
    let extracted = extract_from_zip(app_handle, "deno", &zip_path, dest, vec!["deno.exe"])?;
    emit_progress(app_handle, "deno", 100.0, &format!("Extracted: {}", extracted.join(", ")));
    if let Err(e) = fs::remove_file(&zip_path) {
        eprintln!("[tools] Warning: failed to clean up {:?}: {}", zip_path, e);
    }
    Ok(())
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolBatchItemResult {
    pub tool: String,
    pub success: bool,
    pub message: String,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolBatchResult {
    pub results: Vec<ToolBatchItemResult>,
    pub summary: String,
    pub all_succeeded: bool,
}

async fn download_single_tool(
    app_handle: &tauri::AppHandle,
    bin_dir: &PathBuf,
    tool: &str,
    channels: &std::collections::HashMap<String, String>,
) -> Result<String, String> {
    match tool {
        "yt-dlp" => {
            let is_nightly = channels.get("yt-dlp").map(|s| s.as_str()) == Some("nightly");
            download_ytdlp(app_handle, bin_dir, is_nightly).await?;
            Ok("Installed successfully".to_string())
        }
        "ffmpeg" => {
            let is_nightly = channels.get("ffmpeg").map(|s| s.as_str()) == Some("nightly");
            let variant = None;
            download_ffmpeg(app_handle, bin_dir, variant, is_nightly).await?;
            Ok("Installed successfully".to_string())
        }
        "aria2" => {
            download_aria2(app_handle, bin_dir).await?;
            Ok("Installed successfully".to_string())
        }
        "deno" => {
            download_deno(app_handle, bin_dir).await?;
            Ok("Installed successfully".to_string())
        }
        _ => Err(format!("Unknown tool: {}", tool)),
    }
}

/// Update a tool at its original (system) location instead of the app bin dir.
/// `variant` controls which FFmpeg build to download (Full Build / Essentials / Shared).
/// `channel` controls stable vs nightly (only yt-dlp and ffmpeg support nightly).
#[tauri::command]
pub async fn update_tool_at_path(
    app_handle: tauri::AppHandle,
    tool: String,
    dest_dir: String,
    variant: Option<String>,
    channel: Option<String>,
) -> Result<String, String> {
    let dest = PathBuf::from(&dest_dir);
    if !dest.exists() {
        return Err(format!("Directory does not exist: {}", dest_dir));
    }

    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";

    match tool.as_str() {
        "yt-dlp" => {
            download_ytdlp(&app_handle, &dest, is_nightly).await?;
        }
        "ffmpeg" => {
            download_ffmpeg(&app_handle, &dest, variant, is_nightly).await?;
        }
        "aria2" => {
            download_aria2(&app_handle, &dest).await?;
        }
        "deno" => {
            download_deno(&app_handle, &dest).await?;
        }
        _ => return Err(format!("Unknown tool: {}", tool)),
    }

    Ok(format!("{} updated at {}", tool, dest_dir))
}

#[tauri::command]
pub async fn download_tools(app_handle: tauri::AppHandle, tools: Vec<String>, channels: Option<std::collections::HashMap<String, String>>) -> Result<ToolBatchResult, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_handle;
        let _ = tools;
        let _ = channels;
        return Err("download_tools is currently supported on Windows only".to_string());
    }

    let ch = channels.unwrap_or_default();
    let bin_dir = app_handle.path().app_data_dir().map_err(|e: tauri::Error| e.to_string())?.join("bin");
    
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    }

    let mut seen = HashSet::new();
    let mut results: Vec<ToolBatchItemResult> = Vec::new();

    for tool in tools {
        if !seen.insert(tool.clone()) {
            continue;
        }

        match download_single_tool(&app_handle, &bin_dir, &tool, &ch).await {
            Ok(message) => results.push(ToolBatchItemResult {
                tool,
                success: true,
                message,
            }),
            Err(message) => results.push(ToolBatchItemResult {
                tool,
                success: false,
                message,
            }),
        }
    }

    let success_count = results.iter().filter(|item| item.success).count();
    let failure_count = results.len().saturating_sub(success_count);
    let all_succeeded = failure_count == 0;

    let summary = if results.is_empty() {
        "No tools were selected".to_string()
    } else if all_succeeded {
        format!("{} tool(s) completed successfully", success_count)
    } else if success_count == 0 {
        format!("All {} tool(s) failed", failure_count)
    } else {
        format!("{} succeeded, {} failed", success_count, failure_count)
    };

    Ok(ToolBatchResult {
        results,
        summary,
        all_succeeded,
    })
}

#[tauri::command]
pub fn stage_manual_tool(app_handle: tauri::AppHandle, tool: String, source: String) -> Result<String, String> {
    let bin_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("bin");

    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    }

    let normalized_source = if cfg!(target_os = "windows") {
        source.replace("/", "\\")
    } else {
        source
    };
    let source_path = PathBuf::from(normalized_source);

    if !source_path.exists() {
        return Err("Source path does not exist".to_string());
    }
    if !source_path.is_file() {
        return Err("Source path is not a file".to_string());
    }

    let (dest_name, expected_filename, extra_sidecar) = match tool.as_str() {
        "yt-dlp" => ("yt-dlp.exe", "yt-dlp.exe", None),
        "ffmpeg" => ("ffmpeg.exe", "ffmpeg.exe", Some("ffprobe.exe")),
        "aria2" => ("aria2c.exe", "aria2c.exe", None),
        "deno" => ("deno.exe", "deno.exe", None),
        _ => return Err("Unsupported tool id".to_string()),
    };

    if let Some(file_name) = source_path.file_name().and_then(|n| n.to_str()) {
        if !file_name.eq_ignore_ascii_case(expected_filename) {
            return Err(format!(
                "Expected '{}' but got '{}'. Please select the correct binary.",
                expected_filename, file_name
            ));
        }
    }

    let dest_path = bin_dir.join(dest_name);
    let temp_dest = temp_path_for(&dest_path)?;

    if temp_dest.exists() {
        let _ = fs::remove_file(&temp_dest);
    }

    fs::copy(&source_path, &temp_dest).map_err(|e| format!("Failed to copy file: {}", e))?;

    let metadata = fs::metadata(&temp_dest).map_err(|e| format!("Failed to read copied file: {}", e))?;
    if metadata.len() == 0 {
        let _ = fs::remove_file(&temp_dest);
        return Err("Copied file is empty".to_string());
    }

    safe_replace_with_backup(&dest_path, &temp_dest)?;

    if let Some(sidecar_name) = extra_sidecar {
        if let Some(parent) = source_path.parent() {
            let sidecar_source = parent.join(sidecar_name);
            if sidecar_source.exists() && sidecar_source.is_file() {
                let sidecar_dest = bin_dir.join(sidecar_name);
                let _ = fs::copy(sidecar_source, sidecar_dest);
            }
        }
    }

    Ok(dest_path.to_string_lossy().to_string())
}

// ── Tool backup / rollback ──

pub const TOOL_BINARIES: &[(&str, &[&str])] = &[
    ("yt-dlp", &["yt-dlp.exe"]),
    ("ffmpeg", &["ffmpeg.exe", "ffprobe.exe"]),
    ("aria2", &["aria2c.exe"]),
    ("deno", &["deno.exe"]),
];

fn tool_id_for_binary(bin_name: &str) -> Option<&'static str> {
    for &(id, binaries) in TOOL_BINARIES {
        for &b in binaries {
            if bin_name.eq_ignore_ascii_case(b) {
                return Some(id);
            }
        }
    }
    None
}

fn collect_backup_dirs(app_handle: &tauri::AppHandle, extra_paths: &Option<Vec<String>>) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    if let Ok(bin_dir) = app_handle.path().app_data_dir().map(|d| d.join("bin")) {
        if bin_dir.exists() {
            dirs.push(bin_dir);
        }
    }

    if let Some(paths) = extra_paths {
        for p in paths {
            let path = Path::new(p);
            if let Some(parent) = path.parent() {
                if parent.exists() && !dirs.iter().any(|d| d == parent) {
                    dirs.push(parent.to_path_buf());
                }
            }
        }
    }

    dirs
}

#[tauri::command]
pub fn list_tool_backups(app_handle: tauri::AppHandle, extra_paths: Option<Vec<String>>) -> Result<Vec<String>, String> {
    let dirs = collect_backup_dirs(&app_handle, &extra_paths);
    let mut tool_ids: Vec<String> = Vec::new();

    for dir in &dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".old") {
                    let original = name.trim_end_matches(".old");
                    if let Some(id) = tool_id_for_binary(original) {
                        if !tool_ids.contains(&id.to_string()) {
                            tool_ids.push(id.to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(tool_ids)
}

#[tauri::command]
pub fn rollback_tool(app_handle: tauri::AppHandle, tool: String, extra_paths: Option<Vec<String>>) -> Result<String, String> {
    let dirs = collect_backup_dirs(&app_handle, &extra_paths);

    let binaries: &[&str] = TOOL_BINARIES
        .iter()
        .find(|&&(id, _)| id == tool.as_str())
        .map(|&(_, bins)| bins)
        .ok_or_else(|| format!("Unknown tool: {}", tool))?;

    let mut rolled_back = Vec::new();
    for dir in &dirs {
        for &bin_name in binaries {
            let current = dir.join(bin_name);
            let backup = dir.join(format!("{}.old", bin_name));

            if !backup.exists() {
                continue;
            }

            let temp = dir.join(format!("{}.rollback-tmp", bin_name));
            if current.exists() {
                fs::rename(&current, &temp).map_err(|e| {
                    format!("Failed to move current {} aside: {}", bin_name, e)
                })?;
            }

            match fs::rename(&backup, &current) {
                Ok(()) => {
                    if temp.exists() {
                        let _ = fs::remove_file(&temp);
                    }
                    rolled_back.push(format!("{} ({})", bin_name, dir.display()));
                }
                Err(e) => {
                    if temp.exists() {
                        let _ = fs::rename(&temp, &current);
                    }
                    return Err(format!("Failed to restore backup for {}: {}", bin_name, e));
                }
            }
        }
    }

    if rolled_back.is_empty() {
        return Err(format!("No backups found for {}", tool));
    }

    Ok(format!("Rolled back: {}", rolled_back.join(", ")))
}

#[tauri::command]
pub fn cleanup_tool_backup(app_handle: tauri::AppHandle, tool: String, extra_paths: Option<Vec<String>>) -> Result<String, String> {
    let dirs = collect_backup_dirs(&app_handle, &extra_paths);

    let binaries: &[&str] = TOOL_BINARIES
        .iter()
        .find(|&&(id, _)| id == tool.as_str())
        .map(|&(_, bins)| bins)
        .ok_or_else(|| format!("Unknown tool: {}", tool))?;

    let mut cleaned = Vec::new();
    for dir in &dirs {
        for &bin_name in binaries {
            let backup = dir.join(format!("{}.old", bin_name));
            if backup.exists() {
                fs::remove_file(&backup).map_err(|e| {
                    format!("Failed to remove {}.old: {}", bin_name, e)
                })?;
                cleaned.push(format!("{} ({})", bin_name, dir.display()));
            }
        }
    }

    Ok(format!("Cleaned: {}", cleaned.join(", ")))
}

#[tauri::command]
pub fn cleanup_all_backups(app_handle: tauri::AppHandle, extra_paths: Option<Vec<String>>) -> Result<String, String> {
    let dirs = collect_backup_dirs(&app_handle, &extra_paths);

    let mut count = 0u32;
    for dir in &dirs {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".old") {
                    let original = name.trim_end_matches(".old");
                    if tool_id_for_binary(original).is_some() {
                        if let Err(e) = fs::remove_file(entry.path()) {
                            eprintln!("[tools] Warning: failed to remove {}: {}", name, e);
                        } else {
                            count += 1;
                        }
                    }
                }
            }
        }
    }

    Ok(format!("Removed {} backup file(s)", count))
}

#[tauri::command]
pub fn cleanup_bin_tools(app_handle: tauri::AppHandle, tools: Vec<String>) -> Result<String, String> {
    let bin_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("bin");

    if !bin_dir.exists() {
        return Ok("No bin directory to clean".to_string());
    }

    let mut removed = 0u32;

    for tool in tools {
        let binaries: &[&str] = TOOL_BINARIES
            .iter()
            .find(|&&(id, _)| id == tool.as_str())
            .map(|&(_, bins)| bins)
            .ok_or_else(|| format!("Unknown tool: {}", tool))?;

        for &bin_name in binaries {
            let current = bin_dir.join(bin_name);
            if current.exists() {
                fs::remove_file(&current).map_err(|e| format!("Failed to remove {}: {}", current.display(), e))?;
                removed += 1;
            }

            let backup = bin_dir.join(format!("{}.old", bin_name));
            if backup.exists() {
                fs::remove_file(&backup).map_err(|e| format!("Failed to remove {}: {}", backup.display(), e))?;
                removed += 1;
            }
        }
    }

    for extra in ["aria2.zip", "aria2-update.zip", "deno.zip", "deno-update.zip", "ffmpeg-update.zip", "ffmpeg-update.7z"] {
        let p = bin_dir.join(extra);
        if p.exists() {
            let _ = fs::remove_file(&p);
        }
    }

    Ok(format!("Removed {} file(s) from bin", removed))
}
