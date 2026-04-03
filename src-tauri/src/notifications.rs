use serde::Deserialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWindowsToastPayload {
    pub title: String,
    pub body: String,
    pub launch: Option<String>,
}

#[tauri::command]
pub fn send_native_windows_toast(
    app: AppHandle,
    payload: NativeWindowsToastPayload,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        send_native_windows_toast_impl(app, payload)
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = payload;
        Err("Native Windows toasts are only available on Windows".to_string())
    }
}

#[cfg(target_os = "windows")]
const WINDOWS_TOAST_APP_ID: &str = "HalalDL.Desktop";

#[cfg(target_os = "windows")]
fn send_native_windows_toast_impl(
    app: AppHandle,
    payload: NativeWindowsToastPayload,
) -> Result<(), String> {
    use std::env;

    use windows::Win32::Foundation::RPC_E_CHANGED_MODE;
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED};
    use windows::Data::Xml::Dom::XmlDocument;
    use windows::UI::Notifications::{ToastNotification, ToastNotificationManager};
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    if payload.title.trim().is_empty() {
        return Err("Notification title cannot be empty".to_string());
    }

    if let Some(launch) = payload.launch.as_ref() {
        let normalized = launch.trim().to_ascii_lowercase();
        if !normalized.starts_with("halaldl://") {
            return Err("Notification launch URI must use the halaldl:// scheme".to_string());
        }
    }

    let did_initialize_com = unsafe {
        let result = CoInitializeEx(None, COINIT_MULTITHREADED);
        if result == RPC_E_CHANGED_MODE {
            false
        } else {
            result.ok().map_err(|error| error.to_string())?;
            true
        }
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(format!(r"Software\Classes\AppUserModelId\{WINDOWS_TOAST_APP_ID}"))
        .map_err(|error| error.to_string())?;
    let display_name = app
        .config()
        .product_name
        .clone()
        .unwrap_or_else(|| "HalalDL".to_string());
    key.set_value("DisplayName", &display_name)
        .map_err(|error| error.to_string())?;
    key.set_value("IconBackgroundColor", &"0")
        .map_err(|error| error.to_string())?;
    key.set_value(
        "IconUri",
        &env::current_exe()
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .to_string(),
    )
    .map_err(|error| error.to_string())?;

    let document = XmlDocument::new().map_err(|error| error.to_string())?;
    document
        .LoadXml(&build_toast_xml(&payload))
        .map_err(|error| error.to_string())?;

    let toast = ToastNotification::CreateToastNotification(&document)
        .map_err(|error| error.to_string())?;
    let notifier =
        ToastNotificationManager::CreateToastNotifierWithId(&WINDOWS_TOAST_APP_ID.into())
            .map_err(|error| error.to_string())?;
    let result = notifier.Show(&toast).map_err(|error| error.to_string());

    if did_initialize_com {
        unsafe {
            CoUninitialize();
        }
    }

    result
}

#[cfg(target_os = "windows")]
fn build_toast_xml(payload: &NativeWindowsToastPayload) -> windows::core::HSTRING {
    let activation_attrs = payload
        .launch
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| {
            format!(
                r#" activationType="protocol" launch="{}""#,
                escape_xml(value)
            )
        })
        .unwrap_or_default();
    let body = if payload.body.trim().is_empty() {
        String::new()
    } else {
        format!("<text>{}</text>", escape_xml(&payload.body))
    };

    windows::core::HSTRING::from(format!(
        r#"<toast{activation_attrs}>
  <visual>
    <binding template="ToastGeneric">
      <text>{title}</text>
      {body}
    </binding>
  </visual>
</toast>"#,
        title = escape_xml(&payload.title),
        body = body,
    ))
}

#[cfg(target_os = "windows")]
fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
