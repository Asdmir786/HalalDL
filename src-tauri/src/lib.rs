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

const MAX_DOWNLOAD_RETRIES: u8 = 3;

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
        emit_progress(&app_handle, "ffmpeg", 99.0, "Extracting ffmpeg.exe, ffprobe.exe...");
        let extracted = extract_from_zip(&app_handle, "ffmpeg", &ffmpeg_zip_path, &bin_dir, vec!["ffmpeg.exe", "ffprobe.exe"])?;
        emit_progress(&app_handle, "ffmpeg", 100.0, &format!("Extracted: {}", extracted.join(", ")));
        let _ = fs::remove_file(ffmpeg_zip_path);
    }

    // 3. Download aria2
    if tools.contains(&"aria2".to_string()) {
        let aria2_url = "https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip";
        let aria2_zip_path = bin_dir.join("aria2.zip");
        download_file(&app_handle, "aria2", aria2_url, &aria2_zip_path).await?;
        emit_progress(&app_handle, "aria2", 99.0, "Extracting aria2c.exe...");
        let extracted = extract_from_zip(&app_handle, "aria2", &aria2_zip_path, &bin_dir, vec!["aria2c.exe"])?;
        emit_progress(&app_handle, "aria2", 100.0, &format!("Extracted: {}", extracted.join(", ")));
        let _ = fs::remove_file(aria2_zip_path);
    }

    // 4. Download Deno
    if tools.contains(&"deno".to_string()) {
        let deno_url = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip";
        let deno_zip_path = bin_dir.join("deno.zip");
        download_file(&app_handle, "deno", deno_url, &deno_zip_path).await?;
        emit_progress(&app_handle, "deno", 99.0, "Extracting deno.exe...");
        let extracted = extract_from_zip(&app_handle, "deno", &deno_zip_path, &bin_dir, vec!["deno.exe"])?;
        emit_progress(&app_handle, "deno", 100.0, &format!("Extracted: {}", extracted.join(", ")));
        let _ = fs::remove_file(deno_zip_path);
    }

    Ok("Selected tools downloaded successfully".to_string())
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
    
    let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;

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
            
            emit_progress(app_handle, tool_name, 99.0, &format!("Extracting {}...", target_name));
            
            // Create output file
            let mut outfile = fs::File::create(&dest_file).map_err(|e| format!("Failed to create output file {}: {}", target_name, e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("Failed to extract file {}: {}", target_name, e))?;
            
            // Verify file exists and has size > 0
            let metadata = fs::metadata(&dest_file).map_err(|e| format!("Failed to read metadata for {}: {}", target_name, e))?;
            if metadata.len() == 0 {
                return Err(format!("Extracted file {} is empty", target_name));
            }

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&dest_file, perms).map_err(|e| e.to_string())?;
            }

            found_targets.push(target_name);
        }
    }

    if found_targets.len() != targets.len() {
        return Err(format!("Missing files. Found {:?}, expected {:?}", found_targets, targets));
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
fn copy_files_to_clipboard(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::mem::{size_of, MaybeUninit};
        use std::os::windows::ffi::OsStrExt;
        use std::ptr;
        use windows_sys::Win32::Foundation::GetLastError;
        use windows_sys::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData};
        use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT};

        extern "system" {
            fn GlobalFree(hMem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
        }

        const CF_HDROP: u32 = 0x000F;

        if paths.is_empty() {
            return Err("No files provided".to_string());
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

        let mut wide_list: Vec<u16> = Vec::new();
        for path in &paths {
            let normalized = path.trim().replace('/', "\\");
            if normalized.is_empty() {
                continue;
            }
            wide_list.extend(OsStr::new(&normalized).encode_wide());
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
            if hglobal == std::ptr::null_mut() {
                return Err(format!("GlobalAlloc failed: {}", GetLastError()));
            }

            let locked = GlobalLock(hglobal) as *mut u8;
            if locked.is_null() {
                GlobalFree(hglobal);
                return Err(format!("GlobalLock failed: {}", GetLastError()));
            }

            let mut header = MaybeUninit::<DropFiles>::zeroed();
            header.write(DropFiles {
                p_files: dropfiles_size as u32,
                pt: Point { x: 0, y: 0 },
                f_nc: 0,
                f_wide: 1,
            });
            ptr::copy_nonoverlapping(
                header.as_ptr() as *const u8,
                locked,
                dropfiles_size,
            );

            let dest = locked.add(dropfiles_size) as *mut u16;
            ptr::copy_nonoverlapping(wide_list.as_ptr(), dest, wide_list.len());

            GlobalUnlock(hglobal);

            if OpenClipboard(std::ptr::null_mut()) == 0 {
                GlobalFree(hglobal);
                return Err(format!("OpenClipboard failed: {}", GetLastError()));
            }

            if EmptyClipboard() == 0 {
                CloseClipboard();
                GlobalFree(hglobal);
                return Err(format!("EmptyClipboard failed: {}", GetLastError()));
            }

            if SetClipboardData(CF_HDROP, hglobal) == std::ptr::null_mut() {
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
                        *effect_locked = 1;
                        GlobalUnlock(hglobal_effect);
                        if SetClipboardData(format_id, hglobal_effect) == std::ptr::null_mut() {
                            GlobalFree(hglobal_effect);
                        }
                    } else {
                        GlobalFree(hglobal_effect);
                    }
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
        .invoke_handler(tauri::generate_handler![greet, download_tools, add_to_user_path, show_in_folder, open_path, delete_file, copy_files_to_clipboard])
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();
            win.set_focus().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
