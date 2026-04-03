use std::fs;

#[tauri::command]
pub fn copy_files_to_clipboard(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use image::codecs::png::PngEncoder;
        use image::{ExtendedColorType, ImageEncoder, ImageReader};
        use std::ffi::OsStr;
        use std::io::Cursor;
        use std::mem::size_of;
        use std::os::windows::ffi::OsStrExt;
        use std::path::{Path, PathBuf};
        use std::ptr;
        use windows_sys::Win32::Foundation::GetLastError;
        use windows_sys::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData};
        use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT};

        extern "system" {
            fn GlobalFree(hMem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
        }

        const CF_HDROP: u32 = 0x000F;
        const CF_DIB: u32 = 8;
        const CF_UNICODETEXT: u32 = 13;

        if paths.is_empty() {
            return Err("No files provided".to_string());
        }

        fn is_single_image_clipboard_candidate(path: &Path) -> bool {
            matches!(
                path.extension()
                    .and_then(|value| value.to_str())
                    .map(|value| value.to_ascii_lowercase())
                    .as_deref(),
                Some("png" | "jpg" | "jpeg" | "bmp" | "webp")
            )
        }

        fn make_png_format_name() -> Vec<u16> {
            OsStr::new("PNG")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect()
        }

        fn make_clipboard_format_name(name: &str) -> Vec<u16> {
            OsStr::new(name)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect()
        }

        fn load_image_clipboard_payload(path: &Path) -> Option<(Vec<u8>, Vec<u8>)> {
            if !is_single_image_clipboard_candidate(path) {
                return None;
            }

            let reader = ImageReader::open(path).ok()?;
            let image = reader.decode().ok()?.into_rgba8();
            let (width, height) = image.dimensions();
            if width == 0 || height == 0 {
                return None;
            }

            let mut dib = Vec::with_capacity(40 + image.len());
            dib.extend_from_slice(&40u32.to_le_bytes());
            dib.extend_from_slice(&(width as i32).to_le_bytes());
            dib.extend_from_slice(&(-(height as i32)).to_le_bytes());
            dib.extend_from_slice(&1u16.to_le_bytes());
            dib.extend_from_slice(&32u16.to_le_bytes());
            dib.extend_from_slice(&0u32.to_le_bytes());
            dib.extend_from_slice(&(width.saturating_mul(height).saturating_mul(4)).to_le_bytes());
            dib.extend_from_slice(&0i32.to_le_bytes());
            dib.extend_from_slice(&0i32.to_le_bytes());
            dib.extend_from_slice(&0u32.to_le_bytes());
            dib.extend_from_slice(&0u32.to_le_bytes());

            for pixel in image.pixels() {
                dib.push(pixel[2]);
                dib.push(pixel[1]);
                dib.push(pixel[0]);
                dib.push(pixel[3]);
            }

            let mut png = Vec::new();
            let encoder = PngEncoder::new(Cursor::new(&mut png));
            encoder
                .write_image(image.as_raw(), width, height, ExtendedColorType::Rgba8)
                .ok()?;

            Some((dib, png))
        }

        unsafe fn set_clipboard_bytes(format_id: u32, bytes: &[u8]) -> bool {
            if bytes.is_empty() {
                return false;
            }

            let handle = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, bytes.len());
            if handle.is_null() {
                return false;
            }

            let locked = GlobalLock(handle) as *mut u8;
            if locked.is_null() {
                GlobalFree(handle);
                return false;
            }

            ptr::copy_nonoverlapping(bytes.as_ptr(), locked, bytes.len());
            GlobalUnlock(handle);

            if SetClipboardData(format_id, handle).is_null() {
                GlobalFree(handle);
                return false;
            }

            true
        }

        fn normalize_input_path(raw: &str) -> String {
            let mut trimmed = raw.trim().replace('\r', "").replace('\n', "");
            let lower = trimmed.to_ascii_lowercase();
            if lower.starts_with("file://") {
                trimmed = trimmed[7..].to_string();
            } else if lower.starts_with("file:/") {
                trimmed = trimmed[6..].to_string();
            }
            if trimmed.to_ascii_lowercase().starts_with("localhost/") {
                trimmed = trimmed[10..].to_string();
            }
            if trimmed.as_bytes().get(0) == Some(&b'/') {
                if trimmed.len() >= 3 {
                    let bytes = trimmed.as_bytes();
                    if bytes[2] == b':' && (bytes[1] as char).is_ascii_alphabetic() {
                        trimmed = trimmed[1..].to_string();
                    }
                }
            }
            let trimmed = trimmed.trim();

            let unquoted = if (trimmed.starts_with('"') && trimmed.ends_with('"'))
                || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
            {
                &trimmed[1..trimmed.len().saturating_sub(1)]
            } else {
                trimmed
            };

            unquoted.trim().replace('/', "\\")
        }

        fn strip_extended_prefix_wide(wide: Vec<u16>) -> Vec<u16> {
            const PREFIX: &[u16] = &[92, 92, 63, 92]; // \\?\
            const UNC_PREFIX: &[u16] = &[92, 92, 63, 92, 85, 78, 67, 92]; // \\?\UNC\

            if wide.starts_with(UNC_PREFIX) {
                let mut out = Vec::with_capacity(2 + wide.len().saturating_sub(UNC_PREFIX.len()));
                out.extend_from_slice(&[92, 92]); // \\
                out.extend_from_slice(&wide[UNC_PREFIX.len()..]);
                return out;
            }

            if wide.starts_with(PREFIX) {
                return wide[PREFIX.len()..].to_vec();
            }

            wide
        }

        fn make_clipboard_text(paths: &[PathBuf]) -> Vec<u8> {
            let text = paths
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>()
                .join("\r\n");
            let mut wide: Vec<u16> = text.encode_utf16().collect();
            wide.push(0);

            let mut bytes = Vec::with_capacity(wide.len() * size_of::<u16>());
            for unit in wide {
                bytes.extend_from_slice(&unit.to_le_bytes());
            }
            bytes
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

        let mut valid_paths: Vec<PathBuf> = Vec::new();
        for path in &paths {
            let normalized_input = normalize_input_path(path);
            if normalized_input.is_empty() {
                continue;
            }

            let mut path_buf = PathBuf::from(normalized_input);
            if !path_buf.is_absolute() {
                path_buf = fs::canonicalize(&path_buf).unwrap_or(path_buf);
            }

            if fs::metadata(&path_buf).is_err() {
                continue;
            }

            valid_paths.push(path_buf);
        }

        if valid_paths.is_empty() {
            return Err("No valid files provided".to_string());
        }

        let mut wide_list: Vec<u16> = Vec::new();
        for path_buf in &valid_paths {
            let wide = strip_extended_prefix_wide(path_buf.as_os_str().encode_wide().collect());
            if wide.is_empty() {
                continue;
            }
            wide_list.extend(wide);
            wide_list.push(0);
        }
        wide_list.push(0);

        if wide_list.len() <= 1 {
            return Err("No valid files provided".to_string());
        }

        let clipboard_text = make_clipboard_text(&valid_paths);
        let dropfiles_size = size_of::<DropFiles>();
        let bytes_size = dropfiles_size + (wide_list.len() * size_of::<u16>());

        unsafe {
            let hglobal = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, bytes_size);
            if hglobal.is_null() {
                return Err(format!("GlobalAlloc failed: {}", GetLastError()));
            }

            let locked = GlobalLock(hglobal) as *mut u8;
            if locked.is_null() {
                GlobalFree(hglobal);
                return Err(format!("GlobalLock failed: {}", GetLastError()));
            }

            let header = DropFiles {
                p_files: dropfiles_size as u32,
                pt: Point { x: 0, y: 0 },
                f_nc: 0,
                f_wide: 1,
            };
            
            ptr::copy_nonoverlapping(
                &header as *const DropFiles as *const u8,
                locked,
                dropfiles_size,
            );

            let dest = locked.add(dropfiles_size) as *mut u16;
            ptr::copy_nonoverlapping(wide_list.as_ptr(), dest, wide_list.len());

            GlobalUnlock(hglobal);

            let mut opened = false;
            for _ in 0..5 {
                if OpenClipboard(std::ptr::null_mut()) != 0 {
                    opened = true;
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }

            if !opened {
                GlobalFree(hglobal);
                return Err(format!("OpenClipboard failed: {}", GetLastError()));
            }

            if EmptyClipboard() == 0 {
                CloseClipboard();
                GlobalFree(hglobal);
                return Err(format!("EmptyClipboard failed: {}", GetLastError()));
            }

            let text_copied = set_clipboard_bytes(CF_UNICODETEXT, &clipboard_text);
            let file_drop_copied = SetClipboardData(CF_HDROP, hglobal).is_null() == false;
            if !file_drop_copied {
                GlobalFree(hglobal);
            }

            if valid_paths.len() == 1 && file_drop_copied {
                if let Some((dib_bytes, png_bytes)) = load_image_clipboard_payload(&valid_paths[0]) {
                    let _ = set_clipboard_bytes(CF_DIB, &dib_bytes);

                    let png_format_id = RegisterClipboardFormatW(make_png_format_name().as_ptr());
                    if png_format_id != 0 {
                        let _ = set_clipboard_bytes(png_format_id, &png_bytes);
                    }
                }
            }

            let format_name = make_clipboard_format_name("Preferred DropEffect");
            let format_id = RegisterClipboardFormatW(format_name.as_ptr());
            if format_id != 0 && file_drop_copied {
                let effect_bytes_size = size_of::<u32>();
                let hglobal_effect = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, effect_bytes_size);
                if !hglobal_effect.is_null() {
                    let effect_locked = GlobalLock(hglobal_effect) as *mut u32;
                    if !effect_locked.is_null() {
                        *effect_locked = 1; // DROPEFFECT_COPY
                        GlobalUnlock(hglobal_effect);
                        if SetClipboardData(format_id, hglobal_effect).is_null() {
                            GlobalFree(hglobal_effect);
                        }
                    } else {
                        GlobalFree(hglobal_effect);
                    }
                }
            }

            CloseClipboard();

            if !text_copied && !file_drop_copied {
                return Err("Failed to write any clipboard data".to_string());
            }
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = paths;
        Err("copy_files_to_clipboard is only supported on Windows".to_string())
    }
}

#[tauri::command]
pub fn read_text_from_clipboard() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::mem::size_of;
        use windows_sys::Win32::Foundation::GetLastError;
        use windows_sys::Win32::System::DataExchange::{CloseClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard};
        use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};

        const CF_UNICODETEXT: u32 = 13;

        let mut opened = false;
        for _ in 0..5 {
            if unsafe { OpenClipboard(std::ptr::null_mut()) } != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        if !opened {
            return Err(format!("OpenClipboard failed: {}", unsafe { GetLastError() }));
        }

        let out = (|| unsafe {
            if IsClipboardFormatAvailable(CF_UNICODETEXT) == 0 {
                return Ok(String::new());
            }

            let handle = GetClipboardData(CF_UNICODETEXT);
            if handle.is_null() {
                return Ok(String::new());
            }

            let locked = GlobalLock(handle) as *const u16;
            if locked.is_null() {
                return Err(format!("GlobalLock failed: {}", GetLastError()));
            }

            let mut len: usize = 0;
            let max_units: usize = 1024 * 1024;
            while len < max_units {
                let v = *locked.add(len);
                if v == 0 {
                    break;
                }
                len += 1;
            }

            let bytes_len = len.saturating_mul(size_of::<u16>());
            let slice = std::slice::from_raw_parts(locked, bytes_len / size_of::<u16>());
            let text = String::from_utf16_lossy(slice);

            let _ = GlobalUnlock(handle);
            Ok(text)
        })();

        unsafe { CloseClipboard() };
        out
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("read_text_from_clipboard is only supported on Windows".to_string())
    }
}
