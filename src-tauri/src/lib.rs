use tauri::Emitter;
use tauri::Manager;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    tool: String,
    percentage: f64,
    status: String,
}

const MAX_DOWNLOAD_RETRIES: u8 = 3;

fn temp_path_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid target path: {}", path.display()))?;
    Ok(path.with_file_name(format!("{}.new", file_name)))
}

fn backup_path_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid target path: {}", path.display()))?;
    Ok(path.with_file_name(format!("{}.old", file_name)))
}

fn safe_replace_with_backup(dest: &Path, incoming: &Path) -> Result<(), String> {
    let backup = backup_path_for(dest)?;

    // Keep existing .old backup — user can revert or clean up from the UI.
    // If a backup already exists, remove it only to make room for the new one.
    if backup.exists() && dest.exists() {
        let _ = fs::remove_file(&backup);
    }

    if dest.exists() {
        fs::rename(dest, &backup).map_err(|e| {
            format!(
                "Failed to backup existing file {} -> {}: {}",
                dest.display(),
                backup.display(),
                e
            )
        })?;
    }

    match fs::rename(incoming, dest) {
        Ok(()) => Ok(()),
        Err(e) => {
            // Best-effort rollback if swapping in the new file failed.
            if backup.exists() {
                let _ = fs::rename(&backup, dest);
            }
            Err(format!(
                "Failed to activate new file {} -> {}: {}",
                incoming.display(),
                dest.display(),
                e
            ))
        }
    }
}

/// Download any URL directly to a local file (used for thumbnails).
#[tauri::command]
async fn download_url_to_file(url: String, dest: String, referer: Option<String>) -> Result<String, String> {
    use tokio::io::AsyncWriteExt;

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut req = client.get(&url);
    if let Some(ref r) = referer {
        req = req.header("Referer", r);
    }

    let resp = req.send().await.map_err(|e| format!("Download failed: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("Read body failed: {}", e))?;
    if bytes.is_empty() {
        return Err("Empty response body".to_string());
    }

    let dest_path = Path::new(&dest);
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir failed: {}", e))?;
        }
    }

    let mut file = tokio::fs::File::create(&dest).await
        .map_err(|e| format!("File create failed: {}", e))?;
    file.write_all(&bytes).await
        .map_err(|e| format!("File write failed: {}", e))?;
    file.flush().await
        .map_err(|e| format!("File flush failed: {}", e))?;

    Ok(dest)
}

async fn resolve_latest_aria2_zip_url(app_handle: &tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.github.com/repos/aria2/aria2/releases/latest")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("GitHub API failed with status: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let assets = json
        .get("assets")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Missing assets in GitHub release response".to_string())?;

    for asset in assets {
        let name = asset.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if name.ends_with(".zip")
            && !name.ends_with(".zip.asc")
            && name.to_lowercase().contains("win-64bit")
        {
            if let Some(url) = asset.get("browser_download_url").and_then(|v| v.as_str()) {
                return Ok(url.to_string());
            }
        }
    }

    Err("No matching aria2 Windows zip asset found".to_string())
}

/// Resolve the full system path of a tool using `where` (Windows).
#[tauri::command]
fn resolve_system_tool_path(tool: String) -> Result<Option<String>, String> {
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

/// Update a tool at its original (system) location instead of the app bin dir.
/// `variant` controls which FFmpeg build to download (Full Build / Essentials / Shared).
/// `channel` controls stable vs nightly (only yt-dlp and ffmpeg support nightly).
#[tauri::command]
async fn update_tool_at_path(
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
            let url = if is_nightly {
                "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe"
            } else {
                "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
            };
            download_file(&app_handle, "yt-dlp", url, &dest.join("yt-dlp.exe")).await?;
        }
        "ffmpeg" => {
            let variant_lower = variant.as_deref().unwrap_or("").to_lowercase();
            if is_nightly {
                let url = if variant_lower.contains("essentials") {
                    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-essentials.7z"
                } else {
                    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z"
                };
                let archive_path = dest.join("ffmpeg-update.7z");
                download_file(&app_handle, "ffmpeg", url, &archive_path).await?;
                emit_progress(&app_handle, "ffmpeg", 99.0, "Extracting ffmpeg.exe, ffprobe.exe from 7z...");
                let extracted = extract_from_7z(&app_handle, "ffmpeg", &archive_path, &dest, vec!["ffmpeg.exe", "ffprobe.exe"])?;
                emit_progress(&app_handle, "ffmpeg", 100.0, &format!("Extracted: {}", extracted.join(", ")));
                if let Err(e) = fs::remove_file(&archive_path) {
                    eprintln!("[tools] Warning: failed to clean up {:?}: {}", archive_path, e);
                }
            } else {
                let url = if variant_lower.contains("shared") {
                    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full-shared.zip"
                } else if variant_lower.contains("essentials") {
                    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
                } else {
                    "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.zip"
                };
                let zip_path = dest.join("ffmpeg-update.zip");
                download_file(&app_handle, "ffmpeg", url, &zip_path).await?;
                emit_progress(&app_handle, "ffmpeg", 99.0, "Extracting ffmpeg.exe, ffprobe.exe...");
                let extracted = extract_from_zip(&app_handle, "ffmpeg", &zip_path, &dest, vec!["ffmpeg.exe", "ffprobe.exe"])?;
                emit_progress(&app_handle, "ffmpeg", 100.0, &format!("Extracted: {}", extracted.join(", ")));
                if let Err(e) = fs::remove_file(&zip_path) {
                    eprintln!("[tools] Warning: failed to clean up {:?}: {}", zip_path, e);
                }
            }
        }
        "aria2" => {
            let url = match resolve_latest_aria2_zip_url(&app_handle).await {
                Ok(u) => u,
                Err(_) => "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip".to_string(),
            };
            let zip_path = dest.join("aria2-update.zip");
            download_file(&app_handle, "aria2", &url, &zip_path).await?;
            emit_progress(&app_handle, "aria2", 99.0, "Extracting aria2c.exe...");
            let extracted = extract_from_zip(&app_handle, "aria2", &zip_path, &dest, vec!["aria2c.exe"])?;
            emit_progress(&app_handle, "aria2", 100.0, &format!("Extracted: {}", extracted.join(", ")));
            if let Err(e) = fs::remove_file(&zip_path) {
                eprintln!("[tools] Warning: failed to clean up {:?}: {}", zip_path, e);
            }
        }
        "deno" => {
            let url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
            let zip_path = dest.join("deno-update.zip");
            download_file(&app_handle, "deno", url, &zip_path).await?;
            emit_progress(&app_handle, "deno", 99.0, "Extracting deno.exe...");
            let extracted = extract_from_zip(&app_handle, "deno", &zip_path, &dest, vec!["deno.exe"])?;
            emit_progress(&app_handle, "deno", 100.0, &format!("Extracted: {}", extracted.join(", ")));
            if let Err(e) = fs::remove_file(&zip_path) {
                eprintln!("[tools] Warning: failed to clean up {:?}: {}", zip_path, e);
            }
        }
        _ => return Err(format!("Unknown tool: {}", tool)),
    }

    Ok(format!("{} updated at {}", tool, dest_dir))
}

#[tauri::command]
async fn download_tools(app_handle: tauri::AppHandle, tools: Vec<String>, channels: Option<std::collections::HashMap<String, String>>) -> Result<String, String> {
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

    // 1. Download yt-dlp
    if tools.contains(&"yt-dlp".to_string()) {
        let is_nightly = ch.get("yt-dlp").map(|s| s.as_str()) == Some("nightly");
        let yt_dlp_url = if is_nightly {
            "https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe"
        } else {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        };
        download_file(&app_handle, "yt-dlp", yt_dlp_url, &bin_dir.join("yt-dlp.exe")).await?;
    }

    // 2. Download FFmpeg
    if tools.contains(&"ffmpeg".to_string()) {
        let is_nightly = ch.get("ffmpeg").map(|s| s.as_str()) == Some("nightly");
        if is_nightly {
            let ffmpeg_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z";
            let ffmpeg_7z_path = bin_dir.join("ffmpeg.7z");
            download_file(&app_handle, "ffmpeg", ffmpeg_url, &ffmpeg_7z_path).await?;
            emit_progress(&app_handle, "ffmpeg", 99.0, "Extracting ffmpeg.exe, ffprobe.exe from 7z...");
            let extracted = extract_from_7z(&app_handle, "ffmpeg", &ffmpeg_7z_path, &bin_dir, vec!["ffmpeg.exe", "ffprobe.exe"])?;
            emit_progress(&app_handle, "ffmpeg", 100.0, &format!("Extracted: {}", extracted.join(", ")));
            if let Err(e) = fs::remove_file(&ffmpeg_7z_path) {
                eprintln!("[tools] Warning: failed to clean up {:?}: {}", ffmpeg_7z_path, e);
            }
        } else {
            let ffmpeg_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.zip";
            let ffmpeg_zip_path = bin_dir.join("ffmpeg.zip");
            download_file(&app_handle, "ffmpeg", ffmpeg_url, &ffmpeg_zip_path).await?;
            emit_progress(&app_handle, "ffmpeg", 99.0, "Extracting ffmpeg.exe, ffprobe.exe...");
            let extracted = extract_from_zip(&app_handle, "ffmpeg", &ffmpeg_zip_path, &bin_dir, vec!["ffmpeg.exe", "ffprobe.exe"])?;
            emit_progress(&app_handle, "ffmpeg", 100.0, &format!("Extracted: {}", extracted.join(", ")));
            if let Err(e) = fs::remove_file(&ffmpeg_zip_path) {
                eprintln!("[tools] Warning: failed to clean up {:?}: {}", ffmpeg_zip_path, e);
            }
        }
    }

    // 3. Download aria2
    if tools.contains(&"aria2".to_string()) {
        let aria2_url = match resolve_latest_aria2_zip_url(&app_handle).await {
            Ok(url) => url,
            Err(_) => "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip".to_string(),
        };
        let aria2_zip_path = bin_dir.join("aria2.zip");
        download_file(&app_handle, "aria2", &aria2_url, &aria2_zip_path).await?;
        emit_progress(&app_handle, "aria2", 99.0, "Extracting aria2c.exe...");
        let extracted = extract_from_zip(&app_handle, "aria2", &aria2_zip_path, &bin_dir, vec!["aria2c.exe"])?;
        emit_progress(&app_handle, "aria2", 100.0, &format!("Extracted: {}", extracted.join(", ")));
        if let Err(e) = fs::remove_file(&aria2_zip_path) {
            eprintln!("[tools] Warning: failed to clean up {:?}: {}", aria2_zip_path, e);
        }
    }

    // 4. Download Deno
    if tools.contains(&"deno".to_string()) {
        let deno_url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
        let deno_zip_path = bin_dir.join("deno.zip");
        download_file(&app_handle, "deno", deno_url, &deno_zip_path).await?;
        emit_progress(&app_handle, "deno", 99.0, "Extracting deno.exe...");
        let extracted = extract_from_zip(&app_handle, "deno", &deno_zip_path, &bin_dir, vec!["deno.exe"])?;
        emit_progress(&app_handle, "deno", 100.0, &format!("Extracted: {}", extracted.join(", ")));
        if let Err(e) = fs::remove_file(&deno_zip_path) {
            eprintln!("[tools] Warning: failed to clean up {:?}: {}", deno_zip_path, e);
        }
    }

    Ok("Selected tools downloaded successfully".to_string())
}

#[tauri::command]
fn stage_manual_tool(app_handle: tauri::AppHandle, tool: String, source: String) -> Result<String, String> {
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

    // Validate selected file name matches the expected binary
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

use std::io::Write;

async fn download_file(
    app_handle: &tauri::AppHandle,
    tool_name: &str,
    url: &str,
    dest: &PathBuf,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let mut last_error: Option<String> = None;

    for attempt in 1..=MAX_DOWNLOAD_RETRIES {
        let result = download_file_once(&client, app_handle, tool_name, url, dest).await;
        match result {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_error = Some(e);
                if attempt < MAX_DOWNLOAD_RETRIES {
                    emit_progress(
                        app_handle,
                        tool_name,
                        0.0,
                        &format!(
                            "Retrying download (attempt {}/{})...",
                            attempt + 1,
                            MAX_DOWNLOAD_RETRIES
                        ),
                    );
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Download failed after retries".to_string()))
}

async fn download_file_once(
    client: &reqwest::Client,
    app_handle: &tauri::AppHandle,
    tool_name: &str,
    url: &str,
    dest: &PathBuf,
) -> Result<(), String> {
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
    let temp_dest = temp_path_for(dest)?;
    if temp_dest.exists() {
        let _ = fs::remove_file(&temp_dest);
    }

    let mut file = fs::File::create(&temp_dest).map_err(|e| e.to_string())?;

    let mut last_percentage = 0.0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percentage = (downloaded as f64 / total_size as f64) * 100.0;
            if percentage - last_percentage >= 1.0 || percentage >= 100.0 {
                emit_progress(app_handle, tool_name, percentage, "Downloading...");
                last_percentage = percentage;
            }
        }
    }

    file.flush().map_err(|e| e.to_string())?;

    let metadata = fs::metadata(&temp_dest).map_err(|e| e.to_string())?;
    if metadata.len() == 0 {
        let _ = fs::remove_file(&temp_dest);
        return Err("Downloaded file is empty".to_string());
    }

    safe_replace_with_backup(dest, &temp_dest)?;

    Ok(())
}

fn extract_from_zip(app_handle: &tauri::AppHandle, tool_name: &str, zip_path: &PathBuf, dest_dir: &PathBuf, targets: Vec<&str>) -> Result<Vec<String>, String> {
    emit_progress(app_handle, tool_name, 99.0, "Opening archive...");
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut found_targets = Vec::new();

    emit_progress(app_handle, tool_name, 99.0, &format!("Scanning {} files...", archive.len()));

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let filename = outpath.file_name().unwrap_or_default().to_string_lossy();
        
        if targets.iter().any(|&t| filename.to_lowercase() == t.to_lowercase()) {
            let target_name = filename.to_string();
            let dest_file = dest_dir.join(&target_name);
            let temp_dest = temp_path_for(&dest_file)?;
            
            emit_progress(app_handle, tool_name, 99.0, &format!("Extracting {}...", target_name));
            
            // Create output file
            if temp_dest.exists() {
                let _ = fs::remove_file(&temp_dest);
            }
            let mut outfile = fs::File::create(&temp_dest).map_err(|e| format!("Failed to create output file {}: {}", target_name, e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to extract file {}: {}", target_name, e))?;
            outfile.flush().map_err(|e| format!("Failed to flush file {}: {}", target_name, e))?;
            
            // Verify file exists and has size > 0
            let metadata = fs::metadata(&temp_dest).map_err(|e| format!("Failed to read metadata for {}: {}", target_name, e))?;
            if metadata.len() == 0 {
                return Err(format!("Extracted file {} is empty", target_name));
            }

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&temp_dest, perms).map_err(|e| e.to_string())?;
            }

            safe_replace_with_backup(&dest_file, &temp_dest)?;
            found_targets.push(target_name);
        }
    }

    if found_targets.len() != targets.len() {
        return Err(format!("Missing files. Found {:?}, expected {:?}", found_targets, targets));
    }

    Ok(found_targets)
}

fn extract_from_7z(app_handle: &tauri::AppHandle, tool_name: &str, archive_path: &PathBuf, dest_dir: &PathBuf, targets: Vec<&str>) -> Result<Vec<String>, String> {
    emit_progress(app_handle, tool_name, 99.0, "Opening 7z archive...");
    let mut found_targets: Vec<String> = Vec::new();

    let file = fs::File::open(archive_path).map_err(|e| format!("Failed to open 7z archive: {}", e))?;

    fn to_7z_err(msg: String) -> sevenz_rust::Error {
        sevenz_rust::Error::Other(std::borrow::Cow::Owned(msg))
    }

    sevenz_rust::decompress_with_extract_fn(file, dest_dir, |entry, reader, _dest| {
        let entry_name = entry.name().to_string();
        let file_name = Path::new(&entry_name)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if !targets.iter().any(|&t| file_name.eq_ignore_ascii_case(t)) {
            return Ok(true);
        }

        let target_name = file_name.clone();
        let dest_file = dest_dir.join(&target_name);
        let temp_dest = dest_file.with_file_name(format!("{}.new", target_name));

        if temp_dest.exists() {
            let _ = fs::remove_file(&temp_dest);
        }

        let mut outfile = fs::File::create(&temp_dest)
            .map_err(|e| to_7z_err(format!("Failed to create {}: {}", target_name, e)))?;
        std::io::copy(reader, &mut outfile)
            .map_err(|e| to_7z_err(format!("Failed to extract {}: {}", target_name, e)))?;
        outfile.flush()
            .map_err(|e| to_7z_err(format!("Failed to flush {}: {}", target_name, e)))?;

        let metadata = fs::metadata(&temp_dest)
            .map_err(|e| to_7z_err(format!("Metadata read failed: {}", e)))?;
        if metadata.len() == 0 {
            return Err(to_7z_err(format!("Extracted file {} is empty", target_name)));
        }

        safe_replace_with_backup(&dest_file, &temp_dest)
            .map_err(|e| to_7z_err(e))?;

        found_targets.push(target_name);
        Ok(true)
    }).map_err(|e| format!("7z extraction failed: {}", e))?;

    if found_targets.len() != targets.len() {
        return Err(format!("Missing files from 7z. Found {:?}, expected {:?}", found_targets, targets));
    }

    Ok(found_targets)
}

fn emit_progress(app_handle: &tauri::AppHandle, tool: &str, percentage: f64, status: &str) {
    let _ = app_handle.emit("download-progress", DownloadProgress {
        tool: tool.to_string(),
        percentage,
        status: status.to_string(),
    });
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn add_to_user_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        let bin_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?.join("bin");
        let bin_path = bin_dir.to_string_lossy().to_string();

        // Check if path is already in user PATH
        let current_path = Command::new("powershell")
            .args(&["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('Path', 'User')"])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output()
            .map_err(|e| e.to_string())?;
        
        let current_path_str = String::from_utf8_lossy(&current_path.stdout);
        
        if !current_path_str.contains(&bin_path) {
            // Append to User PATH
            let new_path = format!("{};{}", current_path_str.trim(), bin_path);
            let _ = Command::new("powershell")
                .args(&[
                    "-NoProfile", 
                    "-Command", 
                    &format!("[Environment]::SetEnvironmentVariable('Path', '{}', 'User')", new_path)
                ])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output()
                .map_err(|e| e.to_string())?;
            
            return Ok("Added to User PATH".to_string());
        }
        
        return Ok("Already in User PATH".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Not supported on non-Windows".to_string())
    }
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    let normalized = if cfg!(target_os = "windows") {
        path.replace("/", "\\")
    } else {
        path
    };

    if normalized.trim().is_empty() {
        return Err("Path is empty".to_string());
    }

    let p = PathBuf::from(normalized);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(&p, contents.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let normalized = if cfg!(target_os = "windows") {
        path.replace("/", "\\")
    } else {
        path
    };

    if normalized.trim().is_empty() {
        return Err("Path is empty".to_string());
    }

    let p = PathBuf::from(normalized);
    fs::read_to_string(&p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn fetch_latest_ytdlp_version(app_handle: tauri::AppHandle, channel: Option<String>) -> Result<String, String> {
    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";
    let repo = if is_nightly {
        "yt-dlp/yt-dlp-nightly-builds"
    } else {
        "yt-dlp/yt-dlp"
    };

    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(format!("https://api.github.com/repos/{}/releases/latest", repo))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let tag = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if tag.is_empty() {
        return Err("Missing tag_name".to_string());
    }

    Ok(tag.trim_start_matches('v').trim().to_string())
}

#[tauri::command]
async fn fetch_latest_aria2_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.github.com/repos/aria2/aria2/releases/latest")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let tag = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if tag.is_empty() {
        return Err("Missing tag_name".to_string());
    }

    Ok(tag
        .trim_start_matches("release-")
        .trim_start_matches('v')
        .trim()
        .to_string())
}

#[tauri::command]
async fn fetch_latest_deno_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://dl.deno.land/release-latest.txt")
        .header("Accept", "text/plain,*/*")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let version = text.trim().split_whitespace().next().unwrap_or("").trim();
    if version.is_empty() {
        return Err("Empty response".to_string());
    }
    Ok(version.trim_start_matches('v').trim().to_string())
}

#[tauri::command]
async fn fetch_latest_ffmpeg_version(app_handle: tauri::AppHandle, channel: Option<String>) -> Result<String, String> {
    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";
    let url = if is_nightly {
        "https://www.gyan.dev/ffmpeg/builds/git-version"
    } else {
        "https://www.gyan.dev/ffmpeg/builds/release-version"
    };

    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(url)
        .header("Accept", "text/plain,*/*")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let version = text.trim().split_whitespace().next().unwrap_or("").trim();
    if version.is_empty() {
        return Err("Empty response".to_string());
    }
    Ok(version.to_string())
}

#[tauri::command]
async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::path::Path;
        use std::os::windows::process::CommandExt;
        let path = path.replace("/", "\\");
        
        let p = Path::new(&path);
        if p.exists() {
            if p.is_dir() {
                Command::new("explorer")
                    .arg(&path)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            } else {
                // Use raw_arg to pass the argument exactly as explorer expects it: /select,"path"
                // This prevents Rust from quoting the entire "/select,path" string which causes explorer to fail
                Command::new("explorer")
                    .raw_arg(format!("/select,\"{}\"", path))
                    .spawn()
                    .map_err(|e| e.to_string())?;
            }
        } else {
            if let Some(parent) = p.parent() {
                Command::new("explorer")
                    .arg(parent)
                    .spawn()
                    .map_err(|e| e.to_string())?;
            } else {
                return Err(format!("Path does not exist: {}", path));
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Try xdg-open first, might open folder but not select file
        // Or try nautilus/dolphin/etc if known
        Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/")))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;

        fn escape_ps_single_quoted(s: &str) -> String {
            s.replace("'", "''")
        }

        let normalized = path.replace("/", "\\");
        let cmd = format!("Start-Process -FilePath '{}'", escape_ps_single_quoted(&normalized));

        Command::new("powershell")
            .args(["-NoProfile", "-Command", &cmd])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;
    
    let p = Path::new(&path);
    if p.exists() {
        if p.is_dir() {
            fs::remove_dir_all(p).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(p).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn rename_file(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| format!("Rename failed: {}", e))
}

#[tauri::command]
fn copy_files_to_clipboard(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::mem::size_of;
        use std::os::windows::ffi::OsStrExt;
        use std::ptr;
        use windows_sys::Win32::Foundation::GetLastError;
        use windows_sys::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData};
        use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT};
        use std::path::PathBuf;

        extern "system" {
            fn GlobalFree(hMem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
        }

        const CF_HDROP: u32 = 0x000F;
        const CF_UNICODETEXT: u32 = 13;

        if paths.is_empty() {
            return Err("No files provided".to_string());
        }

        fn normalize_input_path(raw: &str) -> String {
            let mut trimmed = raw.trim().replace('\r', "").replace('\n', "");
            let lower = trimmed.to_ascii_lowercase();
            if lower.starts_with("file://") {
                trimmed = trimmed[7..].to_string();
            } else if lower.starts_with("file:/") {
                trimmed = trimmed[6..].to_string();
            }
            if trimmed.to_ascii_lowercase().starts_with("localhost/") {
                trimmed = trimmed[10..].to_string();
            }
            if trimmed.as_bytes().get(0) == Some(&b'/') {
                if trimmed.len() >= 3 {
                    let bytes = trimmed.as_bytes();
                    if bytes[2] == b':' && (bytes[1] as char).is_ascii_alphabetic() {
                        trimmed = trimmed[1..].to_string();
                    }
                }
            }
            let trimmed = trimmed.trim();

            let unquoted = if (trimmed.starts_with('"') && trimmed.ends_with('"'))
                || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
            {
                &trimmed[1..trimmed.len().saturating_sub(1)]
            } else {
                trimmed
            };

            unquoted.trim().replace('/', "\\")
        }

        fn strip_extended_prefix_wide(wide: Vec<u16>) -> Vec<u16> {
            const PREFIX: &[u16] = &[92, 92, 63, 92]; // \\?\
            const UNC_PREFIX: &[u16] = &[92, 92, 63, 92, 85, 78, 67, 92]; // \\?\UNC\

            if wide.starts_with(UNC_PREFIX) {
                let mut out = Vec::with_capacity(2 + wide.len().saturating_sub(UNC_PREFIX.len()));
                out.extend_from_slice(&[92, 92]); // \\
                out.extend_from_slice(&wide[UNC_PREFIX.len()..]);
                return out;
            }

            if wide.starts_with(PREFIX) {
                return wide[PREFIX.len()..].to_vec();
            }

            wide
        }

        #[repr(C)]
        struct Point {
            x: i32,
            y: i32,
        }

        #[repr(C)]
        struct DropFiles {
            p_files: u32,
            pt: Point,
            f_nc: i32,
            f_wide: i32,
        }

        let mut valid_paths: Vec<PathBuf> = Vec::new();
        for path in &paths {
            let normalized_input = normalize_input_path(path);
            if normalized_input.is_empty() {
                continue;
            }

            let mut path_buf = PathBuf::from(normalized_input);
            if !path_buf.is_absolute() {
                path_buf = fs::canonicalize(&path_buf).unwrap_or(path_buf);
            }

            if fs::metadata(&path_buf).is_err() {
                continue;
            }

            valid_paths.push(path_buf);
        }

        if valid_paths.is_empty() {
            return Err("No valid files provided".to_string());
        }

        let mut wide_list: Vec<u16> = Vec::new();
        for path_buf in &valid_paths {
            let wide = strip_extended_prefix_wide(path_buf.as_os_str().encode_wide().collect());
            if wide.is_empty() {
                continue;
            }
            wide_list.extend(wide);
            wide_list.push(0);
        }
        wide_list.push(0);

        if wide_list.len() <= 1 {
            return Err("No valid files provided".to_string());
        }

        let dropfiles_size = size_of::<DropFiles>();
        let bytes_size = dropfiles_size + (wide_list.len() * size_of::<u16>());

        unsafe {
            let hglobal = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, bytes_size);
            if hglobal.is_null() {
                return Err(format!("GlobalAlloc failed: {}", GetLastError()));
            }

            let locked = GlobalLock(hglobal) as *mut u8;
            if locked.is_null() {
                GlobalFree(hglobal);
                return Err(format!("GlobalLock failed: {}", GetLastError()));
            }

            let header = DropFiles {
                p_files: dropfiles_size as u32,
                pt: Point { x: 0, y: 0 },
                f_nc: 0,
                f_wide: 1,
            };
            
            ptr::copy_nonoverlapping(
                &header as *const DropFiles as *const u8,
                locked,
                dropfiles_size,
            );

            let dest = locked.add(dropfiles_size) as *mut u16;
            ptr::copy_nonoverlapping(wide_list.as_ptr(), dest, wide_list.len());

            GlobalUnlock(hglobal);

            // Retry loop for OpenClipboard as it might be locked by other apps
            let mut opened = false;
            for _ in 0..5 {
                if OpenClipboard(std::ptr::null_mut()) != 0 {
                    opened = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }

            if !opened {
                GlobalFree(hglobal);
                return Err(format!("OpenClipboard failed: {}", GetLastError()));
            }

            if EmptyClipboard() == 0 {
                CloseClipboard();
                GlobalFree(hglobal);
                return Err(format!("EmptyClipboard failed: {}", GetLastError()));
            }

            if SetClipboardData(CF_HDROP, hglobal).is_null() {
                CloseClipboard();
                GlobalFree(hglobal);
                return Err(format!("SetClipboardData(CF_HDROP) failed: {}", GetLastError()));
            }

            let format_name: Vec<u16> = OsStr::new("Preferred DropEffect")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let format_id = RegisterClipboardFormatW(format_name.as_ptr());
            if format_id != 0 {
                let effect_bytes_size = size_of::<u32>();
                let hglobal_effect = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, effect_bytes_size);
                if !hglobal_effect.is_null() {
                    let effect_locked = GlobalLock(hglobal_effect) as *mut u32;
                    if !effect_locked.is_null() {
                        *effect_locked = 1; // DROPEFFECT_COPY
                        GlobalUnlock(hglobal_effect);
                        if SetClipboardData(format_id, hglobal_effect).is_null() {
                            GlobalFree(hglobal_effect);
                        }
                    } else {
                        GlobalFree(hglobal_effect);
                    }
                }
            }

            let first_path = &valid_paths[0];

            let filenamew_format_name: Vec<u16> = OsStr::new("FileNameW")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let filenamew_format_id = RegisterClipboardFormatW(filenamew_format_name.as_ptr());
            if filenamew_format_id != 0 {
                let mut first_wide = strip_extended_prefix_wide(first_path.as_os_str().encode_wide().collect());
                first_wide.push(0);

                let bytes_size = first_wide.len() * size_of::<u16>();
                let hglobal_filenamew = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, bytes_size);
                if !hglobal_filenamew.is_null() {
                    let locked = GlobalLock(hglobal_filenamew) as *mut u16;
                    if !locked.is_null() {
                        ptr::copy_nonoverlapping(first_wide.as_ptr(), locked, first_wide.len());
                        GlobalUnlock(hglobal_filenamew);
                        if SetClipboardData(filenamew_format_id, hglobal_filenamew).is_null() {
                            GlobalFree(hglobal_filenamew);
                        }
                    } else {
                        GlobalFree(hglobal_filenamew);
                    }
                }
            }

            let mut text_wide: Vec<u16> = Vec::new();
            for (idx, p) in valid_paths.iter().enumerate() {
                let wide = strip_extended_prefix_wide(p.as_os_str().encode_wide().collect());
                if wide.is_empty() {
                    continue;
                }
                text_wide.extend(wide);
                if idx + 1 < valid_paths.len() {
                    text_wide.extend_from_slice(&[13, 10]); // \r\n
                }
            }
            text_wide.push(0);

            let text_bytes_size = text_wide.len() * size_of::<u16>();
            let hglobal_text = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, text_bytes_size);
            if !hglobal_text.is_null() {
                let locked = GlobalLock(hglobal_text) as *mut u16;
                if !locked.is_null() {
                    ptr::copy_nonoverlapping(text_wide.as_ptr(), locked, text_wide.len());
                    GlobalUnlock(hglobal_text);
                    if SetClipboardData(CF_UNICODETEXT, hglobal_text).is_null() {
                        GlobalFree(hglobal_text);
                    }
                } else {
                    GlobalFree(hglobal_text);
                }
            }

            CloseClipboard();
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = paths;
        Err("copy_files_to_clipboard is only supported on Windows".to_string())
    }
}

// ── Tool backup / rollback commands ──

const TOOL_BINARIES: &[(&str, &[&str])] = &[
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

/// Collect directories to check for backups: app bin/ + parent dirs of any system paths.
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
fn list_tool_backups(app_handle: tauri::AppHandle, extra_paths: Option<Vec<String>>) -> Result<Vec<String>, String> {
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
fn rollback_tool(app_handle: tauri::AppHandle, tool: String, extra_paths: Option<Vec<String>>) -> Result<String, String> {
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
fn cleanup_tool_backup(app_handle: tauri::AppHandle, tool: String, extra_paths: Option<Vec<String>>) -> Result<String, String> {
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
fn cleanup_all_backups(app_handle: tauri::AppHandle, extra_paths: Option<Vec<String>>) -> Result<String, String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            download_tools,
            stage_manual_tool,
            add_to_user_path,
            write_text_file,
            read_text_file,
            fetch_latest_ytdlp_version,
            fetch_latest_aria2_version,
            fetch_latest_deno_version,
            fetch_latest_ffmpeg_version,
            show_in_folder,
            open_path,
            delete_file,
            rename_file,
            copy_files_to_clipboard,
            download_url_to_file,
            resolve_system_tool_path,
            update_tool_at_path,
            list_tool_backups,
            rollback_tool,
            cleanup_tool_backup,
            cleanup_all_backups
        ])
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();
            win.set_focus().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
