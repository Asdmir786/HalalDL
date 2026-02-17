#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
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
        Command::new("xdg-open")
            .arg(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/")))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
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
pub fn add_to_user_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        use tauri::Manager;

        let bin_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?.join("bin");
        let bin_path = bin_dir.to_string_lossy().to_string();

        let current_path = Command::new("powershell")
            .args(&["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('Path', 'User')"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        
        let current_path_str = String::from_utf8_lossy(&current_path.stdout);
        
        if !current_path_str.contains(&bin_path) {
            let new_path = format!("{};{}", current_path_str.trim(), bin_path);
            let _ = Command::new("powershell")
                .args(&[
                    "-NoProfile", 
                    "-Command", 
                    &format!("[Environment]::SetEnvironmentVariable('Path', '{}', 'User')", new_path)
                ])
                .creation_flags(0x08000000)
                .output()
                .map_err(|e| e.to_string())?;
            
            return Ok("Added to User PATH".to_string());
        }
        
        return Ok("Already in User PATH".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_handle;
        Ok("Not supported on non-Windows".to_string())
    }
}
