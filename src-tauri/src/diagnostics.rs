use serde_json::Value;
use std::fs::File;
use std::io::Write;

fn normalize_output_path(path: String) -> String {
    if cfg!(target_os = "windows") {
        path.replace("/", "\\")
    } else {
        path
    }
}

fn write_json(zip: &mut zip::ZipWriter<File>, name: &str, value: &Value) -> Result<(), String> {
    let options = zip::write::FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    zip.start_file(name, options)
        .map_err(|e| format!("Zip start_file failed ({}): {}", name, e))?;
    let contents = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    zip.write_all(contents.as_bytes())
        .map_err(|e| format!("Zip write failed ({}): {}", name, e))?;
    Ok(())
}

fn write_text(zip: &mut zip::ZipWriter<File>, name: &str, contents: &str) -> Result<(), String> {
    let options = zip::write::FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);
    zip.start_file(name, options)
        .map_err(|e| format!("Zip start_file failed ({}): {}", name, e))?;
    zip.write_all(contents.as_bytes())
        .map_err(|e| format!("Zip write failed ({}): {}", name, e))?;
    Ok(())
}

#[tauri::command]
pub fn export_diagnostics_zip(app_handle: tauri::AppHandle, output_path: String, payload: Value) -> Result<String, String> {
    let output_path = normalize_output_path(output_path);
    if output_path.trim().is_empty() {
        return Err("Output path is empty".to_string());
    }

    let file = File::create(&output_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    let prefix = "HalalDL-diagnostics/";

    let logs_text = payload
        .get("logsText")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let redaction = payload.get("redaction").cloned().unwrap_or(Value::Null);
    let created_at = payload
        .get("createdAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let app_info = serde_json::json!({
        "appVersion": app_handle.package_info().version.to_string(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "createdAt": created_at,
    });

    let build_info = payload.get("buildInfo").cloned().unwrap_or(Value::Null);
    let tools_status = payload.get("toolsStatus").cloned().unwrap_or(Value::Null);
    let settings = payload.get("settings").cloned().unwrap_or(Value::Null);
    let presets = payload.get("presets").cloned().unwrap_or(Value::Null);
    let download_queue = payload.get("downloadQueue").cloned().unwrap_or(Value::Null);
    let history_summary = payload.get("historySummary").cloned().unwrap_or(Value::Null);

    let manifest = serde_json::json!({
        "schemaVersion": 1,
        "createdAt": created_at,
        "redaction": redaction,
        "files": [
            format!("{}manifest.json", prefix),
            format!("{}app-info.json", prefix),
            format!("{}build-info.json", prefix),
            format!("{}tools-status.json", prefix),
            format!("{}settings.json", prefix),
            format!("{}presets.json", prefix),
            format!("{}download-queue.json", prefix),
            format!("{}history-summary.json", prefix),
            format!("{}logs.txt", prefix),
        ]
    });

    write_json(&mut zip, &format!("{}manifest.json", prefix), &manifest)?;
    write_json(&mut zip, &format!("{}app-info.json", prefix), &app_info)?;
    write_json(&mut zip, &format!("{}build-info.json", prefix), &build_info)?;
    write_json(&mut zip, &format!("{}tools-status.json", prefix), &tools_status)?;
    write_json(&mut zip, &format!("{}settings.json", prefix), &settings)?;
    write_json(&mut zip, &format!("{}presets.json", prefix), &presets)?;
    write_json(&mut zip, &format!("{}download-queue.json", prefix), &download_queue)?;
    write_json(&mut zip, &format!("{}history-summary.json", prefix), &history_summary)?;
    write_text(&mut zip, &format!("{}logs.txt", prefix), logs_text)?;

    zip.finish().map_err(|e| format!("Zip finish failed: {}", e))?;
    Ok(output_path)
}
