use tauri::Emitter;
use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use futures_util::StreamExt;

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    tool: String,
    percentage: f64,
    status: String,
}

#[tauri::command]
async fn download_tools(app_handle: tauri::AppHandle, tools: Vec<String>) -> Result<String, String> {
    let bin_dir = app_handle.path().app_data_dir().map_err(|e: tauri::Error| e.to_string())?.join("bin");
    
    if !bin_dir.exists() {
        fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
    }

    // 1. Download yt-dlp
    if tools.contains(&"yt-dlp".to_string()) {
        let yt_dlp_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
        download_file(&app_handle, "yt-dlp", yt_dlp_url, &bin_dir.join("yt-dlp.exe")).await?;
    }

    // 2. Download FFmpeg (Essentials Build)
    if tools.contains(&"ffmpeg".to_string()) {
        let ffmpeg_url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
        let ffmpeg_zip_path = bin_dir.join("ffmpeg.zip");
        download_file(&app_handle, "ffmpeg", ffmpeg_url, &ffmpeg_zip_path).await?;
        emit_progress(&app_handle, "ffmpeg", 99.0, "Extracting...");
        extract_from_zip(&ffmpeg_zip_path, &bin_dir, vec!["ffmpeg.exe", "ffprobe.exe"])?;
        let _ = fs::remove_file(ffmpeg_zip_path);
    }

    // 3. Download aria2
    if tools.contains(&"aria2".to_string()) {
        let aria2_url = "https://github.com/aria2/aria2/releases/latest/download/aria2-1.37.0-win-64bit-build1.zip";
        let aria2_zip_path = bin_dir.join("aria2.zip");
        download_file(&app_handle, "aria2", aria2_url, &aria2_zip_path).await?;
        emit_progress(&app_handle, "aria2", 99.0, "Extracting...");
        extract_from_zip(&aria2_zip_path, &bin_dir, vec!["aria2c.exe"])?;
        let _ = fs::remove_file(aria2_zip_path);
    }

    // 4. Download Deno
    if tools.contains(&"deno".to_string()) {
        let deno_url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
        let deno_zip_path = bin_dir.join("deno.zip");
        download_file(&app_handle, "deno", deno_url, &deno_zip_path).await?;
        emit_progress(&app_handle, "deno", 99.0, "Extracting...");
        extract_from_zip(&deno_zip_path, &bin_dir, vec!["deno.exe"])?;
        let _ = fs::remove_file(deno_zip_path);
    }

    Ok("Selected tools downloaded successfully".to_string())
}

async fn download_file(
    app_handle: &tauri::AppHandle,
    tool_name: &str,
    url: &str,
    dest: &PathBuf,
) -> Result<(), String> {
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);
    
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut buffer = Vec::new();

    let mut last_percentage = 0.0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        buffer.extend_from_slice(&chunk);
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let percentage = (downloaded as f64 / total_size as f64) * 100.0;
            // Only emit if percentage changed by at least 1% or it's done
            if percentage - last_percentage >= 1.0 || percentage >= 100.0 {
                emit_progress(app_handle, tool_name, percentage, "Downloading...");
                last_percentage = percentage;
            }
        }
    }

    fs::write(dest, buffer).map_err(|e| e.to_string())?;
    Ok(())
}

fn extract_from_zip(zip_path: &PathBuf, dest_dir: &PathBuf, targets: Vec<&str>) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let filename = outpath.file_name().unwrap_or_default().to_string_lossy();
        
        if targets.iter().any(|&t| filename.to_lowercase() == t.to_lowercase()) {
            let dest_file = dest_dir.join(filename.as_ref());
            let mut outfile = fs::File::create(&dest_file).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, download_tools])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
