use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};
use tauri_plugin_autostart::ManagerExt as AutostartExt;
use tauri_plugin_positioner::{Position as WindowPosition, WindowExt};

const TRAY_ID: &str = "main-tray";

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSettingsPayload {
    pub close_to_tray: bool,
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatePayload {
    pub active_downloads: usize,
    pub failed_jobs: usize,
    pub queue_paused: bool,
    pub app_update_available: bool,
    pub tool_update_count: usize,
}

#[derive(Clone)]
pub(crate) struct WindowBounds {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
}

#[derive(Default)]
pub struct RuntimeState {
    pub settings: Mutex<RuntimeSettingsPayload>,
    pub tray_state: Mutex<TrayStatePayload>,
    pub pending_launch_urls: Mutex<Vec<String>>,
    pub saved_main_bounds: Mutex<Option<WindowBounds>>,
    pub allow_exit: Mutex<bool>,
    pub launched_from_autostart: Mutex<bool>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayActionPayload {
    pub action: String,
}

fn emit_tray_action(app: &AppHandle, action: &str) {
    let _ = app.emit(
        "tray-action",
        TrayActionPayload {
            action: action.to_string(),
        },
    );
}

fn main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window is unavailable".to_string())
}

fn remember_main_bounds(window: &WebviewWindow, app: &AppHandle) -> Result<(), String> {
    let size = window.outer_size().map_err(|e| e.to_string())?;
    if size.width <= 460 && size.height <= 580 {
        return Ok(());
    }
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let state = app.state::<RuntimeState>();
    let mut saved = state.saved_main_bounds.lock().map_err(|_| "Runtime state lock poisoned".to_string())?;
    *saved = Some(WindowBounds { position, size });
    Ok(())
}

fn apply_saved_bounds(window: &WebviewWindow, app: &AppHandle) -> Result<(), String> {
    let state = app.state::<RuntimeState>();
    let saved = state.saved_main_bounds.lock().map_err(|_| "Runtime state lock poisoned".to_string())?;
    if let Some(bounds) = saved.as_ref() {
        window
            .set_size(Size::Physical(bounds.size))
            .map_err(|e| e.to_string())?;
        window
            .set_position(Position::Physical(bounds.position))
            .map_err(|e| e.to_string())?;
    } else {
        window
            .set_size(Size::Physical(PhysicalSize::new(1000, 600)))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn build_tray_menu<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<tauri::menu::Menu<R>, String> {
    let tray_state = app
        .state::<RuntimeState>()
        .tray_state
        .lock()
        .map_err(|_| "Tray state lock poisoned".to_string())?
        .clone();

    let queue_label = if tray_state.active_downloads > 0 {
        format!("Downloads Active: {}", tray_state.active_downloads)
    } else if tray_state.failed_jobs > 0 {
        format!("Failed Jobs: {}", tray_state.failed_jobs)
    } else {
        "Downloads Idle".to_string()
    };

    let updates_label = if tray_state.app_update_available || tray_state.tool_update_count > 0 {
        format!(
            "Updates Available: app={} tools={}",
            if tray_state.app_update_available { "yes" } else { "no" },
            tray_state.tool_update_count
        )
    } else {
        "Updates: none".to_string()
    };

    let pause_label = if tray_state.queue_paused {
        "Resume Queue"
    } else {
        "Pause New Jobs"
    };

    let status_queue = MenuItemBuilder::with_id("status-queue", queue_label)
        .enabled(false)
        .build(app)
        .map_err(|e| e.to_string())?;
    let status_updates = MenuItemBuilder::with_id("status-updates", updates_label)
        .enabled(false)
        .build(app)
        .map_err(|e| e.to_string())?;
    let download_clipboard = MenuItemBuilder::with_id("download-clipboard", "Download Clipboard")
        .build(app)
        .map_err(|e| e.to_string())?;
    let quick_download = MenuItemBuilder::with_id("quick-download", "Quick Download")
        .build(app)
        .map_err(|e| e.to_string())?;
    let open_app = MenuItemBuilder::with_id("open-app", "Open HalalDL")
        .build(app)
        .map_err(|e| e.to_string())?;
    let pause_queue = MenuItemBuilder::with_id("pause-queue", pause_label)
        .build(app)
        .map_err(|e| e.to_string())?;
    let check_updates = MenuItemBuilder::with_id("check-updates", "Check for Updates")
        .build(app)
        .map_err(|e| e.to_string())?;
    let quit = MenuItemBuilder::with_id("quit", "Quit")
        .build(app)
        .map_err(|e| e.to_string())?;

    MenuBuilder::new(app)
        .item(&status_queue)
        .item(&status_updates)
        .separator()
        .item(&download_clipboard)
        .item(&quick_download)
        .item(&open_app)
        .item(&pause_queue)
        .item(&check_updates)
        .separator()
        .item(&quit)
        .build()
        .map_err(|e| e.to_string())
}

fn refresh_tray(app: &AppHandle) -> Result<(), String> {
    let menu = build_tray_menu(app)?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn append_launch_urls(app: &AppHandle, urls: Vec<String>) {
    if urls.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<RuntimeState>().pending_launch_urls.lock() {
        pending.extend(urls.clone());
    }
    let _ = app.emit("deep-link-received", urls);
}

pub fn capture_launch_urls(args: &[String]) -> Vec<String> {
    args.iter()
        .filter(|arg| arg.to_lowercase().starts_with("halaldl://"))
        .cloned()
        .collect()
}

pub fn attach_main_window_close_handler(window: &WebviewWindow, app: &AppHandle) {
    let app_handle = app.clone();
    let window_handle = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            let state = app_handle.state::<RuntimeState>();
            let allow_exit = state
                .allow_exit
                .lock()
                .map(|flag| *flag)
                .unwrap_or(false);
            let close_to_tray = state
                .settings
                .lock()
                .map(|settings| settings.close_to_tray)
                .unwrap_or(true);

            if !allow_exit && close_to_tray {
                api.prevent_close();
                let _ = window_handle.hide();
            }
        }
    });
}

pub fn init_tray(app: &AppHandle) -> Result<(), String> {
    let menu = build_tray_menu(app)?;
    let icon = app
        .default_window_icon()
        .ok_or_else(|| "Default app icon is unavailable".to_string())?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "download-clipboard" => {
                emit_tray_action(app, "download-clipboard");
            }
            "quick-download" => {
                emit_tray_action(app, "quick-download");
            }
            "open-app" => {
                let _ = restore_main_window(app.clone());
                emit_tray_action(app, "open-app");
            }
            "pause-queue" => {
                let queue_paused = app
                    .state::<RuntimeState>()
                    .tray_state
                    .lock()
                    .map(|state| state.queue_paused)
                    .unwrap_or(false);
                emit_tray_action(app, if queue_paused { "resume-queue" } else { "pause-queue" });
            }
            "check-updates" => {
                let _ = restore_main_window(app.clone());
                emit_tray_action(app, "check-updates");
            }
            "quit" => {
                let _ = quit_application(app.clone());
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = restore_main_window(app.clone());
                emit_tray_action(app, "open-app");
            }
        })
        .build(app)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn sync_runtime_settings(
    app: AppHandle,
    payload: RuntimeSettingsPayload,
) -> Result<(), String> {
    let state = app.state::<RuntimeState>();
    let mut settings = state
        .settings
        .lock()
        .map_err(|_| "Runtime settings lock poisoned".to_string())?;
    *settings = payload;
    Ok(())
}

#[tauri::command]
pub fn update_tray_state(app: AppHandle, payload: TrayStatePayload) -> Result<(), String> {
    {
        let state = app.state::<RuntimeState>();
        let mut tray_state = state
            .tray_state
            .lock()
            .map_err(|_| "Tray state lock poisoned".to_string())?;
        *tray_state = payload;
    }
    refresh_tray(&app)?;
    Ok(())
}

#[tauri::command]
pub fn restore_main_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_resizable(true).map_err(|e| e.to_string())?;
    apply_saved_bounds(&window, &app)?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn show_quick_download_window(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    remember_main_bounds(&window, &app)?;
    window.set_resizable(false).map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window
        .set_size(Size::Physical(PhysicalSize::new(420, 540)))
        .map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.move_window(WindowPosition::BottomRight).map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn hide_main_window_to_tray(app: AppHandle) -> Result<(), String> {
    let window = main_window(&app)?;
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn quit_application(app: AppHandle) -> Result<(), String> {
    {
        let state = app.state::<RuntimeState>();
        let mut allow_exit = state
            .allow_exit
            .lock()
            .map_err(|_| "Runtime exit flag lock poisoned".to_string())?;
        *allow_exit = true;
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn was_launched_from_autostart(app: AppHandle) -> Result<bool, String> {
    let state = app.state::<RuntimeState>();
    state
        .launched_from_autostart
        .lock()
        .map(|value| *value)
        .map_err(|_| "Autostart launch state lock poisoned".to_string())
}

#[tauri::command]
pub fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn take_pending_launch_urls(app: AppHandle) -> Result<Vec<String>, String> {
    let state = app.state::<RuntimeState>();
    let mut pending = state
        .pending_launch_urls
        .lock()
        .map_err(|_| "Launch URL queue lock poisoned".to_string())?;
    let urls = pending.clone();
    pending.clear();
    Ok(urls)
}
