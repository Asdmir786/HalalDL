mod fs_utils;
mod download;
mod extract;
mod tools;
mod version;
mod shell;
mod clipboard;
mod file_commands;

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
            download::download_url_to_file,
            tools::resolve_system_tool_path,
            tools::update_tool_at_path,
            tools::list_tool_backups,
            tools::rollback_tool,
            tools::cleanup_tool_backup,
            tools::cleanup_all_backups
        ])
        .setup(|app| {
            use tauri::Manager;
            let win = app.get_webview_window("main").unwrap();
            win.set_focus().unwrap();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
