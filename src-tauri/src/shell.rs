#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::path::Path;
        use std::process::Command;

        let path = path.replace('/', "\\");
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
        } else if let Some(parent) = p.parent() {
            Command::new("explorer")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            return Err(format!("Path does not exist: {}", path));
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
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        let normalized = path.replace('/', "\\");
        // cmd start opens with the default association without a PowerShell host.
        Command::new("cmd")
            .args(["/C", "start", "", &normalized])
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

fn ps_quote(input: &str) -> String {
    input.replace('\'', "''")
}

#[tauri::command]
pub fn add_to_user_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        let paths = crate::app_paths::ensure_app_dirs(&app_handle)?;
        if paths.is_portable {
            return Ok("Portable mode does not modify User PATH".to_string());
        }

        let bin_path = std::path::PathBuf::from(&paths.bin_dir)
            .to_string_lossy()
            .trim_end_matches(['\\', '/'])
            .to_string();

        let current = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "[Environment]::GetEnvironmentVariable('Path', 'User')",
            ])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        if !current.status.success() {
            return Err(format!(
                "Failed to read User PATH: {}",
                String::from_utf8_lossy(&current.stderr).trim()
            ));
        }

        let current_path_str = String::from_utf8_lossy(&current.stdout);
        let already = current_path_str
            .split(';')
            .map(|p| p.trim().trim_end_matches(['\\', '/']))
            .any(|p| !p.is_empty() && p.eq_ignore_ascii_case(&bin_path));

        if already {
            return Ok("Already in User PATH".to_string());
        }

        let new_path = {
            let trimmed = current_path_str.trim();
            if trimmed.is_empty() {
                bin_path.clone()
            } else {
                format!("{};{}", trimmed, bin_path)
            }
        };

        let set_cmd = format!(
            "[Environment]::SetEnvironmentVariable('Path', '{}', 'User')",
            ps_quote(&new_path)
        );
        let set = Command::new("powershell")
            .args(["-NoProfile", "-Command", &set_cmd])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;
        if !set.status.success() {
            return Err(format!(
                "Failed to update User PATH: {}",
                String::from_utf8_lossy(&set.stderr).trim()
            ));
        }

        Ok("Added to User PATH".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_handle;
        Ok("Not supported on non-Windows".to_string())
    }
}
