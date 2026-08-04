//! Run app-managed tool binaries by absolute path (Full AppData bin / Portable portable-data/bin).
//! Avoids broken shell-plugin `$EXE` / `$APPDATA` sidecar expansion on Windows.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command as TokioCommand};

use crate::app_paths::{ensure_app_dirs, resolve_app_bin_tool};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBinRunResult {
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBinStreamEvent {
    pub session_id: String,
    pub kind: String,
    pub line: Option<String>,
    pub code: Option<i32>,
}

#[derive(Clone, Default)]
pub struct AppBinChildren {
    inner: Arc<Mutex<HashMap<u32, Child>>>,
}

fn resolve_bin_path(app: &AppHandle, binary_name: &str) -> Result<std::path::PathBuf, String> {
    let path = resolve_app_bin_tool(app.clone(), binary_name.to_string())?
        .ok_or_else(|| format!("App-managed binary not found: {binary_name}"))?;
    Ok(std::path::PathBuf::from(path))
}

fn apply_env(cmd: &mut TokioCommand, env: &Option<HashMap<String, String>>) {
    if let Some(map) = env {
        for (key, value) in map {
            cmd.env(key, value);
        }
    }
}

#[tauri::command]
pub async fn run_app_bin_tool(
    app_handle: AppHandle,
    binary_name: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
    timeout_ms: Option<u64>,
) -> Result<AppBinRunResult, String> {
    let _ = ensure_app_dirs(&app_handle)?;
    let path = resolve_bin_path(&app_handle, &binary_name)?;

    let run = async {
        let mut cmd = TokioCommand::new(&path);
        cmd.args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        apply_env(&mut cmd, &env);
        #[cfg(windows)]
        {
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }

        let output = cmd
            .output()
            .await
            .map_err(|e| format!("Failed to run {}: {}", path.display(), e))?;

        Ok(AppBinRunResult {
            code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    };

    match timeout_ms {
        Some(ms) if ms > 0 => tokio::time::timeout(Duration::from_millis(ms), run)
            .await
            .map_err(|_| format!("Timed out after {ms}ms"))?,
        _ => run.await,
    }
}

#[tauri::command]
pub async fn start_app_bin_tool(
    app_handle: AppHandle,
    children: State<'_, AppBinChildren>,
    session_id: String,
    binary_name: String,
    args: Vec<String>,
    env: Option<HashMap<String, String>>,
) -> Result<u32, String> {
    let _ = ensure_app_dirs(&app_handle)?;
    let path = resolve_bin_path(&app_handle, &binary_name)?;

    let mut cmd = TokioCommand::new(&path);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    apply_env(&mut cmd, &env);
    #[cfg(windows)]
    {
        cmd.creation_flags(0x0800_0000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", path.display(), e))?;

    let pid = child
        .id()
        .ok_or_else(|| "Failed to read process id".to_string())?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Missing stdout pipe".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Missing stderr pipe".to_string())?;

    {
        let mut guard = children
            .inner
            .lock()
            .map_err(|_| "Process table lock poisoned".to_string())?;
        guard.insert(pid, child);
    }

    let app_out = app_handle.clone();
    let session_out = session_id.clone();
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_out.emit(
                "app-bin-stream",
                AppBinStreamEvent {
                    session_id: session_out.clone(),
                    kind: "stdout".into(),
                    line: Some(line),
                    code: None,
                },
            );
        }
    });

    let app_err = app_handle.clone();
    let session_err = session_id.clone();
    tauri::async_runtime::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app_err.emit(
                "app-bin-stream",
                AppBinStreamEvent {
                    session_id: session_err.clone(),
                    kind: "stderr".into(),
                    line: Some(line),
                    code: None,
                },
            );
        }
    });

    let app_done = app_handle.clone();
    let session_done = session_id.clone();
    let table = children.inner.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let finished: Option<Option<i32>> = {
                let mut guard = match table.lock() {
                    Ok(g) => g,
                    Err(_) => break,
                };
                match guard.get_mut(&pid) {
                    Some(child) => match child.try_wait() {
                        Ok(Some(status)) => {
                            guard.remove(&pid);
                            Some(status.code())
                        }
                        Ok(None) => None,
                        Err(_) => {
                            guard.remove(&pid);
                            Some(Some(1))
                        }
                    },
                    None => break,
                }
            };

            if let Some(code) = finished {
                let _ = app_done.emit(
                    "app-bin-stream",
                    AppBinStreamEvent {
                        session_id: session_done,
                        kind: "closed".into(),
                        line: None,
                        code,
                    },
                );
                break;
            }
            tokio::time::sleep(Duration::from_millis(40)).await;
        }
    });

    Ok(pid)
}

#[tauri::command]
pub async fn kill_app_bin_tool(
    children: State<'_, AppBinChildren>,
    pid: u32,
) -> Result<(), String> {
    let mut child = {
        let mut guard = children
            .inner
            .lock()
            .map_err(|_| "Process table lock poisoned".to_string())?;
        guard
            .remove(&pid)
            .ok_or_else(|| format!("No running process with pid {pid}"))?
    };
    let _ = child.kill().await;
    let _ = child.wait().await;
    Ok(())
}
