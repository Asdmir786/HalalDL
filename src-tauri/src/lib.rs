mod app_update;
mod clipboard;
mod diagnostics;
mod download;
mod extract;
mod file_commands;
mod fs_utils;
mod shell;
mod tools;
mod version;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .setup(|app| {
            use tauri::Manager;
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
