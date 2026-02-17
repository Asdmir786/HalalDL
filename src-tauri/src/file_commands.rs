use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
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
pub fn read_text_file(path: String) -> Result<String, String> {
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
pub async fn delete_file(path: String) -> Result<(), String> {
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
pub async fn rename_file(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| format!("Rename failed: {}", e))
}
