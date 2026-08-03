use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Path is empty".to_string());
    }

    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }
    }

    fs::write(&p, contents.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("Path is empty".to_string());
    }

    fs::read_to_string(PathBuf::from(&path)).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        return Err(format!(
            "Refusing to delete directory via delete_file: {}",
            path
        ));
    }
    fs::remove_file(&p).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_file(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| format!("Rename failed: {}", e))
}
