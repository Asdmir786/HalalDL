use serde::Serialize;
use std::{fs::File, io::{Read, Write}, path::Path};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionZipResult { pub output_path: String, pub added: usize, pub skipped: Vec<String> }

fn safe_name(path: &str, index: usize) -> String {
    let raw = Path::new(path).file_name().and_then(|v| v.to_str()).unwrap_or("media-file");
    let clean: String = raw.chars().map(|c| if c == '/' || c == '\\' || c == ':' { '_' } else { c }).collect();
    format!("{:04}-{}", index + 1, clean)
}

#[tauri::command]
pub fn export_collection_zip(output_path: String, files: Vec<String>) -> Result<CollectionZipResult, String> {
    if output_path.trim().is_empty() { return Err("Output path is empty".to_string()); }
    let target = File::create(&output_path).map_err(|e| format!("Failed to create ZIP: {}", e))?;
    let mut zip = zip::ZipWriter::new(target);
    let options = zip::write::FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated).unix_permissions(0o644);
    let mut added = 0usize;
    let mut skipped = Vec::new();
    for (index, path) in files.iter().enumerate() {
        let source = Path::new(path);
        if !source.is_file() { skipped.push(path.clone()); continue; }
        let mut input = match File::open(source) { Ok(file) => file, Err(_) => { skipped.push(path.clone()); continue; } };
        let name = format!("Media/{}", safe_name(path, index));
        zip.start_file(name, options).map_err(|e| format!("Could not add ZIP entry: {}", e))?;
        let mut buffer = [0u8; 64 * 1024];
        loop {
            let count = input.read(&mut buffer).map_err(|e| format!("Could not read source file: {}", e))?;
            if count == 0 { break; }
            zip.write_all(&buffer[..count]).map_err(|e| format!("Could not write ZIP: {}", e))?;
        }
        added += 1;
    }
    zip.finish().map_err(|e| format!("Could not finish ZIP: {}", e))?;
    Ok(CollectionZipResult { output_path, added, skipped })
}
