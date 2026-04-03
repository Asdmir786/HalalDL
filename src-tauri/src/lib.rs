mod app_update;
mod clipboard;
mod diagnostics;
mod download;
mod extract;
mod file_commands;
mod fs_utils;
mod notifications;
mod runtime;
mod shell;
mod tools;
mod version;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch_args: Vec<String> = std::env::args().collect();
    let startup_urls = runtime::capture_launch_urls(&launch_args);
    let launched_from_autostart = launch_args
        .iter()
        .any(|arg| arg.eq_ignore_ascii_case("--autostart"));

    let runtime_state = runtime::RuntimeState::default();
    if let Ok(mut launched) = runtime_state.launched_from_autostart.lock() {
        *launched = launched_from_autostart;
    }

    tauri::Builder::default()
        .manage(runtime_state)
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let urls = runtime::capture_launch_urls(&args);
            runtime::append_launch_urls(app, urls);
            let _ = runtime::restore_main_window(app.clone());
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            tools::download_tools,
            tools::stage_manual_tool,
            shell::add_to_user_path,
            file_commands::write_text_file,
            file_commands::read_text_file,
            version::fetch_latest_ytdlp_version,
            version::fetch_latest_aria2_version,
            version::fetch_latest_deno_version,
            version::fetch_latest_ffmpeg_version,
            shell::show_in_folder,
            shell::open_path,
            file_commands::delete_file,
            file_commands::rename_file,
            clipboard::copy_files_to_clipboard,
            clipboard::read_text_from_clipboard,
            download::download_url_to_file,
            download::post_form_for_text,
            runtime::sync_runtime_settings,
            runtime::update_tray_state,
            runtime::restore_main_window,
            runtime::show_quick_download_window,
            runtime::hide_main_window_to_tray,
            runtime::is_main_window_visible,
            runtime::is_autostart_enabled,
            runtime::was_launched_from_autostart,
            runtime::set_autostart_enabled,
            runtime::take_pending_launch_urls,
            notifications::send_native_windows_toast,
            app_update::get_install_context,
            app_update::download_and_verify_app_update,
            tools::resolve_system_tool_path,
            tools::update_tool_at_path,
            tools::list_tool_backups,
            tools::rollback_tool,
            tools::cleanup_tool_backup,
            tools::cleanup_all_backups,
            tools::cleanup_bin_tools,
            diagnostics::export_diagnostics_zip
        ])
        .setup(move |app| {
            use tauri::Manager;
            app.handle()
                .plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                    Some(vec!["--autostart"]),
                ))
                .map_err(|e| e.to_string())?;

            runtime::init_tray(&app.handle()).map_err(|e| e.to_string())?;

            if let Some(win) = app.get_webview_window("main") {
                runtime::attach_main_window_close_handler(&win, &app.handle());
                if launched_from_autostart {
                    let _ = win.hide();
                    let _ = runtime::update_tray_state(
                        app.handle().clone(),
                        app
                            .handle()
                            .state::<runtime::RuntimeState>()
                            .tray_state
                            .lock()
                            .map(|state| state.clone())
                            .unwrap_or_default(),
                    );
                } else {
                    let _ = win.set_focus();
                }
            }

            if !startup_urls.is_empty() {
                runtime::append_launch_urls(&app.handle(), startup_urls.clone());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
