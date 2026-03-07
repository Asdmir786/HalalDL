use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::path::PathBuf;
use futures_util::StreamExt;
use tauri::Emitter;
use sha2::{Digest, Sha256};

use crate::fs_utils::{temp_path_for, safe_replace_with_backup};

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub tool: String,
    pub percentage: f64,
    pub status: String,
}

const MAX_DOWNLOAD_RETRIES: u8 = 3;

pub fn emit_progress(app_handle: &tauri::AppHandle, tool: &str, percentage: f64, status: &str) {
    let _ = app_handle.emit("download-progress", DownloadProgress {
        tool: tool.to_string(),
        percentage,
        status: status.to_string(),
    });
}

/// Download any URL directly to a local file (used for thumbnails).
#[tauri::command]
pub async fn download_url_to_file(url: String, dest: String, referer: Option<String>) -> Result<String, String> {
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

pub fn sha256_of_path(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let read = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let hash = hasher.finalize();
    Ok(hash.iter().map(|b| format!("{:02x}", b)).collect::<String>())
}

pub async fn resolve_latest_aria2_zip_url(app_handle: &tauri::AppHandle) -> Result<String, String> {
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

pub async fn download_to_temp(
    app_handle: &tauri::AppHandle,
    tool_name: &str,
    url: &str,
    dest: &PathBuf,
) -> Result<PathBuf, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let mut last_error: Option<String> = None;

    for attempt in 1..=MAX_DOWNLOAD_RETRIES {
        let result = download_file_once(&client, app_handle, tool_name, url, dest).await;
        match result {
            Ok(temp_dest) => return Ok(temp_dest),
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
) -> Result<PathBuf, String> {
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

    Ok(temp_dest)
}
