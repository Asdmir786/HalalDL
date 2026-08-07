use keyring::Entry;

const SERVICE: &str = "HalalDL AI";

fn entry(profile_id: &str) -> Result<Entry, String> {
    if profile_id.trim().is_empty() || profile_id.len() > 160 {
        return Err("Invalid AI profile identifier".to_string());
    }
    Entry::new(SERVICE, profile_id).map_err(|error| format!("Windows Credential Manager is unavailable: {error}"))
}

#[tauri::command]
pub fn save_ai_api_key(profile_id: String, api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }
    entry(&profile_id)?.set_password(&api_key).map_err(|error| format!("Could not save API key securely: {error}"))
}

#[tauri::command]
pub fn has_ai_api_key(profile_id: String) -> Result<bool, String> {
    match entry(&profile_id)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(error) => Err(format!("Could not check secure API key: {error}")),
    }
}

#[tauri::command]
pub fn remove_ai_api_key(profile_id: String) -> Result<(), String> {
    match entry(&profile_id)?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove secure API key: {error}")),
    }
}
