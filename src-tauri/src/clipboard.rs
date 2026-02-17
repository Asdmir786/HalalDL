use std::fs;

#[tauri::command]
pub fn copy_files_to_clipboard(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::mem::size_of;
        use std::os::windows::ffi::OsStrExt;
        use std::ptr;
        use std::path::PathBuf;
        use windows_sys::Win32::Foundation::GetLastError;
        use windows_sys::Win32::System::DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData};
        use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE, GMEM_ZEROINIT};

        extern "system" {
            fn GlobalFree(hMem: *mut core::ffi::c_void) -> *mut core::ffi::c_void;
        }

        const CF_HDROP: u32 = 0x000F;
        const CF_UNICODETEXT: u32 = 13;

        if paths.is_empty() {
            return Err("No files provided".to_string());
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

            if SetClipboardData(CF_HDROP, hglobal).is_null() {
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

            let first_path = &valid_paths[0];

            let filenamew_format_name: Vec<u16> = OsStr::new("FileNameW")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let filenamew_format_id = RegisterClipboardFormatW(filenamew_format_name.as_ptr());
            if filenamew_format_id != 0 {
                let mut first_wide = strip_extended_prefix_wide(first_path.as_os_str().encode_wide().collect());
                first_wide.push(0);

                let bytes_size = first_wide.len() * size_of::<u16>();
                let hglobal_filenamew = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, bytes_size);
                if !hglobal_filenamew.is_null() {
                    let locked = GlobalLock(hglobal_filenamew) as *mut u16;
                    if !locked.is_null() {
                        ptr::copy_nonoverlapping(first_wide.as_ptr(), locked, first_wide.len());
                        GlobalUnlock(hglobal_filenamew);
                        if SetClipboardData(filenamew_format_id, hglobal_filenamew).is_null() {
                            GlobalFree(hglobal_filenamew);
                        }
                    } else {
                        GlobalFree(hglobal_filenamew);
                    }
                }
            }

            let mut text_wide: Vec<u16> = Vec::new();
            for (idx, p) in valid_paths.iter().enumerate() {
                let wide = strip_extended_prefix_wide(p.as_os_str().encode_wide().collect());
                if wide.is_empty() {
                    continue;
                }
                text_wide.extend(wide);
                if idx + 1 < valid_paths.len() {
                    text_wide.extend_from_slice(&[13, 10]); // \r\n
                }
            }
            text_wide.push(0);

            let text_bytes_size = text_wide.len() * size_of::<u16>();
            let hglobal_text = GlobalAlloc((GMEM_MOVEABLE | GMEM_ZEROINIT) as u32, text_bytes_size);
            if !hglobal_text.is_null() {
                let locked = GlobalLock(hglobal_text) as *mut u16;
                if !locked.is_null() {
                    ptr::copy_nonoverlapping(text_wide.as_ptr(), locked, text_wide.len());
                    GlobalUnlock(hglobal_text);
                    if SetClipboardData(CF_UNICODETEXT, hglobal_text).is_null() {
                        GlobalFree(hglobal_text);
                    }
                } else {
                    GlobalFree(hglobal_text);
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
