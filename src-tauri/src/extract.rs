use std::fs;
use std::io::Write;
use std::path::PathBuf;

use crate::download::emit_progress;
use crate::fs_utils::{safe_replace_with_backup, temp_path_for};

pub fn extract_from_zip(
    app_handle: &tauri::AppHandle,
    tool_name: &str,
    zip_path: &PathBuf,
    dest_dir: &PathBuf,
    targets: Vec<&str>,
) -> Result<Vec<String>, String> {
    emit_progress(app_handle, tool_name, 99.0, "Opening archive...");
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut found_targets = Vec::new();

    emit_progress(
        app_handle,
        tool_name,
        99.0,
        &format!("Scanning {} files...", archive.len()),
    );

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let filename = outpath.file_name().unwrap_or_default().to_string_lossy();

        if targets
            .iter()
            .any(|&t| filename.to_lowercase() == t.to_lowercase())
        {
            let target_name = filename.to_string();
            let dest_file = dest_dir.join(&target_name);
            let temp_dest = temp_path_for(&dest_file)?;

            emit_progress(
                app_handle,
                tool_name,
                99.0,
                &format!("Extracting {}...", target_name),
            );

            if temp_dest.exists() {
                let _ = fs::remove_file(&temp_dest);
            }
            let mut outfile = fs::File::create(&temp_dest).map_err(|e| {
                format!("Failed to create output file {}: {}", target_name, e)
            })?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file {}: {}", target_name, e))?;
            outfile
                .flush()
                .map_err(|e| format!("Failed to flush file {}: {}", target_name, e))?;

            let metadata = fs::metadata(&temp_dest)
                .map_err(|e| format!("Failed to read metadata for {}: {}", target_name, e))?;
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

    if found_targets.is_empty() {
        return Err(format!(
            "None of the expected files ({}) were found in the archive",
            targets.join(", ")
        ));
    }

    Ok(found_targets)
}
