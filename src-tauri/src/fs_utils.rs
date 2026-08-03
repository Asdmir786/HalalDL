use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub fn temp_path_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid target path: {}", path.display()))?;
    Ok(path.with_file_name(format!("{}.new", file_name)))
}

pub fn backup_path_for(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("Invalid target path: {}", path.display()))?;
    Ok(path.with_file_name(format!("{}.old", file_name)))
}

fn copy_replace(from: &Path, to: &Path) -> io::Result<()> {
    fs::copy(from, to)?;
    fs::remove_file(from)?;
    Ok(())
}

pub fn safe_replace_with_backup(dest: &Path, incoming: &Path) -> Result<(), String> {
    let backup = backup_path_for(dest)?;

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
            // Cross-volume renames fail on Windows; fall back to copy+remove.
            if copy_replace(incoming, dest).is_ok() {
                return Ok(());
            }
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
