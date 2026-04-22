#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    if let Err(error) = run() {
        show_error(&error);
    }
}

fn run() -> Result<(), String> {
    let args = parse_args()?;
    let app_dir = PathBuf::from(args.app_dir);
    let zip_path = PathBuf::from(args.zip_path);
    let relaunch_path = app_dir.join(args.relaunch_exe);
    let updates_dir = app_dir.join("portable-data").join("updates");
    fs::create_dir_all(&updates_dir).map_err(|e| e.to_string())?;

    wait_for_process_exit(args.pid)?;

    let staging_dir = updates_dir.join(format!("staging-{}", now_millis()));
    extract_zip(&zip_path, &staging_dir)?;
    apply_portable_update(&staging_dir, &app_dir)?;

    let _ = fs::remove_dir_all(&staging_dir);
    let _ = fs::remove_file(&zip_path);

    Command::new(&relaunch_path)
        .current_dir(&app_dir)
        .spawn()
        .map_err(|e| format!("Failed to relaunch {}: {}", relaunch_path.display(), e))?;

    Ok(())
}

struct Args {
    app_dir: String,
    zip_path: String,
    pid: u32,
    relaunch_exe: String,
}

fn parse_args() -> Result<Args, String> {
    let mut app_dir = None;
    let mut zip_path = None;
    let mut pid = None;
    let mut relaunch_exe = None;

    let mut iter = env::args().skip(1);
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--app-dir" => app_dir = iter.next(),
            "--zip" => zip_path = iter.next(),
            "--pid" => {
                pid = iter
                    .next()
                    .and_then(|value| value.parse::<u32>().ok());
            }
            "--relaunch-exe" => relaunch_exe = iter.next(),
            _ => {}
        }
    }

    Ok(Args {
        app_dir: app_dir.ok_or_else(|| "Missing --app-dir".to_string())?,
        zip_path: zip_path.ok_or_else(|| "Missing --zip".to_string())?,
        pid: pid.ok_or_else(|| "Missing or invalid --pid".to_string())?,
        relaunch_exe: relaunch_exe.ok_or_else(|| "Missing --relaunch-exe".to_string())?,
    })
}

fn extract_zip(zip_path: &Path, staging_dir: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path)
        .map_err(|e| format!("Failed to open update zip {}: {}", zip_path.display(), e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    if staging_dir.exists() {
        fs::remove_dir_all(staging_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(staging_dir).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
        let Some(relative) = entry.enclosed_name().map(|path| path.to_owned()) else {
            continue;
        };
        let out_path = staging_dir.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut output =
            fs::File::create(&out_path).map_err(|e| format!("Failed to create file: {}", e))?;
        io::copy(&mut entry, &mut output).map_err(|e| format!("Failed to extract file: {}", e))?;
    }

    Ok(())
}

fn apply_portable_update(staging_dir: &Path, app_dir: &Path) -> Result<(), String> {
    for source in collect_files(staging_dir)? {
        let relative = source
            .strip_prefix(staging_dir)
            .map_err(|e| e.to_string())?
            .to_path_buf();

        if should_skip_relative_path(&relative) {
            continue;
        }

        let destination = app_dir.join(&relative);
        replace_file(&source, &destination)?;
    }

    Ok(())
}

fn should_skip_relative_path(relative: &Path) -> bool {
    let mut parts = relative.components();
    let Some(first) = parts.next() else {
        return true;
    };
    if first.as_os_str() != OsStr::new("portable-data") {
        return false;
    }

    let Some(second) = parts.next() else {
        return true;
    };
    second.as_os_str() != OsStr::new("bin")
}

fn collect_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];

    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() {
                files.push(path);
            }
        }
    }

    files.sort();
    Ok(files)
}

fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let temp = destination.with_extension("new");
    if temp.exists() {
        let _ = fs::remove_file(&temp);
    }

    fs::copy(source, &temp).map_err(|e| {
        format!(
            "Failed to copy {} to {}: {}",
            source.display(),
            temp.display(),
            e
        )
    })?;

    if destination.exists() {
        fs::remove_file(destination).map_err(|e| {
            format!("Failed to remove {} before update: {}", destination.display(), e)
        })?;
    }

    fs::rename(&temp, destination).map_err(|e| {
        format!(
            "Failed to activate {} at {}: {}",
            source.display(),
            destination.display(),
            e
        )
    })?;

    Ok(())
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

#[cfg(target_os = "windows")]
fn wait_for_process_exit(pid: u32) -> Result<(), String> {
    use std::ptr::null_mut;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, WaitForSingleObject};

    const SYNCHRONIZE_ACCESS: u32 = 0x0010_0000;

    unsafe {
        let handle = OpenProcess(SYNCHRONIZE_ACCESS, 0, pid);
        if handle == null_mut() {
            return Ok(());
        }

        let _ = WaitForSingleObject(handle, 60_000);
        CloseHandle(handle);
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn wait_for_process_exit(_pid: u32) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn show_error(message: &str) {
    use std::ptr::null_mut;
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    fn wide(input: &str) -> Vec<u16> {
        input.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let title = wide("HalalDL Portable Update Failed");
    let body = wide(message);
    unsafe {
        MessageBoxW(null_mut(), body.as_ptr(), title.as_ptr(), MB_OK | MB_ICONERROR);
    }
}

#[cfg(not(target_os = "windows"))]
fn show_error(message: &str) {
    eprintln!("{}", message);
}
