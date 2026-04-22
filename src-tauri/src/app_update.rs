use std::fs;
use std::path::{Path, PathBuf};

use crate::download::{download_to_temp, sha256_of_path};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallContext {
    pub installer_type: String,
    pub install_scope: String,
    pub install_dir: Option<String>,
    pub uninstall_command: Option<String>,
    pub detected_from: Option<String>,
    pub registry_key: Option<String>,
}

impl Default for InstallContext {
    fn default() -> Self {
        Self {
            installer_type: "unknown".to_string(),
            install_scope: "unknown".to_string(),
            install_dir: None,
            uninstall_command: None,
            detected_from: None,
            registry_key: None,
        }
    }
}

fn fallback_install_context() -> InstallContext {
    let mut context = InstallContext::default();
    if let Ok(app_dir) = crate::app_paths::current_exe_dir() {
        let uninstall_exe = app_dir.join("uninstall.exe");
        context.install_dir = Some(app_dir.to_string_lossy().to_string());
        context.detected_from = Some("filesystem".to_string());
        if crate::app_paths::is_portable_layout(&app_dir) {
            context.installer_type = "portable".to_string();
        } else if uninstall_exe.exists() {
            context.installer_type = "nsis".to_string();
        }
    }
    context
}

#[cfg(target_os = "windows")]
fn ps_quote(input: &str) -> String {
    input.replace('\'', "''")
}

async fn fetch_text(app_handle: &tauri::AppHandle, url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}: {}", response.status(), url));
    }

    response.text().await.map_err(|e| e.to_string())
}

fn find_checksum_for_names(text: &str, filenames: &[&str]) -> Option<String> {
    let targets: Vec<String> = filenames.iter().map(|f| f.to_lowercase()).collect();
    let mut best: Option<(usize, String)> = None;

    for raw in text.lines() {
        let line = raw.trim().trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }

        if let Some((name, hash)) = line.split_once(':') {
            let name = name.trim().to_lowercase();
            if let Some(idx) = targets.iter().position(|t| t == &name) {
                let hash = hash.trim();
                if !hash.is_empty() {
                    let hash = hash.to_lowercase();
                    if idx == 0 {
                        return Some(hash);
                    }
                    if best.as_ref().map(|(b, _)| idx < *b).unwrap_or(true) {
                        best = Some((idx, hash));
                    }
                }
            }
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let hash = parts[0].trim();
            let mut name = parts[1].trim();
            name = name.trim_start_matches('*');
            let name = name.to_lowercase();
            if let Some(idx) = targets.iter().position(|t| t == &name) {
                if !hash.is_empty() {
                    let hash = hash.to_lowercase();
                    if idx == 0 {
                        return Some(hash);
                    }
                    if best.as_ref().map(|(b, _)| idx < *b).unwrap_or(true) {
                        best = Some((idx, hash));
                    }
                }
            }
        }
    }

    best.map(|(_, hash)| hash)
}

fn move_verified_file(temp_path: &Path, dest_path: &Path) -> Result<(), String> {
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    if dest_path.exists() {
        if dest_path.is_dir() {
            return Err(format!(
                "Destination is a directory, not a file: {}",
                dest_path.display()
            ));
        }
        fs::remove_file(dest_path).map_err(|e| e.to_string())?;
    }

    fs::rename(temp_path, dest_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_install_context(app_handle: tauri::AppHandle) -> Result<InstallContext, String> {
    if let Ok(app_dir) = crate::app_paths::current_exe_dir() {
        if crate::app_paths::is_portable_layout(&app_dir) {
            return Ok(InstallContext {
                installer_type: "portable".to_string(),
                install_scope: "portable".to_string(),
                install_dir: Some(app_dir.to_string_lossy().to_string()),
                uninstall_command: None,
                detected_from: Some("portable-marker".to_string()),
                registry_key: None,
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        let product_name = app_handle
            .config()
            .product_name
            .clone()
            .unwrap_or_else(|| app_handle.package_info().name.to_string());
        let product_name = ps_quote(&product_name);
        let current_version = ps_quote(&app_handle.package_info().version.to_string());
        let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let current_exe_path = ps_quote(&current_exe.to_string_lossy().replace('/', "\\"));
        let current_exe_dir = current_exe
            .parent()
            .map(|p| p.to_string_lossy().replace('/', "\\"))
            .unwrap_or_default();
        let current_exe_dir = ps_quote(&current_exe_dir);

        let script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
$productName = '{product_name}'
$currentVersion = '{current_version}'
$currentExePath = '{current_exe_path}'
$currentExeDir = '{current_exe_dir}'
$registryPaths = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

$items = foreach ($path in $registryPaths) {{
  Get-ItemProperty -Path $path -ErrorAction SilentlyContinue |
    Where-Object {{
      $_.DisplayName -and ($_.DisplayName -eq $productName -or $_.DisplayName -like ($productName + '*'))
    }} |
    ForEach-Object {{
      $displayName = [string]$_.DisplayName
      $displayVersion = [string]$_.DisplayVersion
      $displayIcon = [string]$_.DisplayIcon
      $installLocation = [string]$_.InstallLocation
      $installSource = [string]$_.InstallSource
      $uninstallString = [string]$_.UninstallString
      $quietUninstallString = [string]$_.QuietUninstallString
      $combined = ($uninstallString + ' ' + $quietUninstallString + ' ' + $displayIcon + ' ' + $installSource).Trim()
      $installerType = 'unknown'
      if ($_.WindowsInstaller -eq 1 -or $combined -match '(?i)\bmsiexec(\.exe)?\b') {{
        $installerType = 'msi'
      }} elseif ($combined -match '(?i)unins[0-9]*\.exe|\\uninstall\.exe\b|nsis') {{
        $installerType = 'nsis'
      }}

      $installScope = if ($_.PSPath -like 'Microsoft.PowerShell.Core\Registry::HKEY_LOCAL_MACHINE*') {{
        'machine'
      }} else {{
        'user'
      }}

      $score = 0
      if ($displayName -eq $productName) {{
        $score += 40
      }} elseif ($displayName -like ($productName + '*')) {{
        $score += 10
      }}
      if ($installLocation) {{
        $normalizedInstall = $installLocation.TrimEnd('\')
        if ($currentExeDir -ieq $normalizedInstall -or $currentExeDir -like ($normalizedInstall + '\*')) {{
          $score += 200
        }}
      }}
      if ($displayIcon -and $displayIcon -like ('*' + $currentExePath + '*')) {{
        $score += 200
      }}
      if ($combined -and $combined -like ('*' + $currentExeDir + '*')) {{
        $score += 120
      }}
      if ($displayVersion -and $displayVersion -eq $currentVersion) {{
        $score += 60
      }}
      if ($installerType -ne 'unknown') {{
        $score += 20
      }}

      [pscustomobject]@{{
        installerType = $installerType
        installScope = $installScope
        installDir = if ($installLocation) {{ $installLocation }} else {{ $null }}
        uninstallCommand = if ($combined) {{ $combined }} else {{ $null }}
        detectedFrom = 'registry'
        registryKey = $_.PSChildName
        score = $score
      }}
    }}
}}

if (-not $items) {{
  $fallbackType = 'unknown'
  if (Test-Path (Join-Path $currentExeDir 'uninstall.exe')) {{
    $fallbackType = 'nsis'
  }}

  [pscustomobject]@{{
    installerType = $fallbackType
    installScope = 'unknown'
    installDir = if ($currentExeDir) {{ $currentExeDir }} else {{ $null }}
    uninstallCommand = $null
    detectedFrom = 'filesystem'
    registryKey = $null
  }} | ConvertTo-Json -Compress
  exit 0
}}

$best = $items |
  Sort-Object -Property @(
    @{{ Expression = 'score'; Descending = $true }},
    @{{ Expression = 'installerType'; Descending = $false }}
  ) |
  Select-Object -First 1

if (-not $best -or $best.score -lt 60) {{
  $fallbackType = 'unknown'
  if (Test-Path (Join-Path $currentExeDir 'uninstall.exe')) {{
    $fallbackType = 'nsis'
  }}

  [pscustomobject]@{{
    installerType = $fallbackType
    installScope = 'unknown'
    installDir = if ($currentExeDir) {{ $currentExeDir }} else {{ $null }}
    uninstallCommand = $null
    detectedFrom = 'filesystem'
    registryKey = $null
  }} | ConvertTo-Json -Compress
  exit 0
}}

$best |
  Select-Object installerType, installScope, installDir, uninstallCommand, detectedFrom, registryKey |
  ConvertTo-Json -Compress
"#
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            return Ok(fallback_install_context());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let trimmed = stdout.trim();
        if trimmed.is_empty() {
            return Ok(fallback_install_context());
        }

        let parsed = serde_json::from_str::<InstallContext>(trimmed);
        return Ok(parsed.unwrap_or_else(|_| fallback_install_context()));
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_handle;
        Ok(fallback_install_context())
    }
}

#[tauri::command]
pub fn launch_portable_update(
    app_handle: tauri::AppHandle,
    zip_path: String,
    relaunch_exe: Option<String>,
) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    let paths = crate::app_paths::ensure_app_dirs(&app_handle)?;
    if !paths.is_portable {
        return Err("Portable updater is only available in portable mode".to_string());
    }

    let app_dir = PathBuf::from(&paths.app_dir);
    let updater_path = app_dir.join("HalalDL.PortableUpdater.exe");
    if !updater_path.exists() {
        return Err(format!(
            "Portable updater was not found at {}",
            updater_path.display()
        ));
    }
    let updates_dir = PathBuf::from(&paths.updates_dir);
    fs::create_dir_all(&updates_dir).map_err(|e| e.to_string())?;
    let staged_updater = updates_dir.join(format!(
        "portable-updater-{}.exe",
        std::process::id()
    ));
    fs::copy(&updater_path, &staged_updater)
        .map_err(|e| format!("Failed to stage portable updater: {}", e))?;

    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let current_pid = std::process::id().to_string();
    let relaunch_target = relaunch_exe
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            current_exe
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("HalalDL.exe")
                .to_string()
        });

    let mut command = Command::new(&staged_updater);
    command.args([
        "--app-dir",
        &paths.app_dir,
        "--zip",
        &zip_path,
        "--pid",
        &current_pid,
        "--relaunch-exe",
        &relaunch_target,
    ]);

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(0x08000000);
    }

    command.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn download_and_verify_app_update(
    app_handle: tauri::AppHandle,
    url: String,
    dest: String,
    checksum_url: String,
    asset_name: String,
) -> Result<String, String> {
    let dest_path = PathBuf::from(&dest);
    if let Some(parent) = dest_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
    }

    let checksum_text = fetch_text(&app_handle, &checksum_url).await?;
    let expected = find_checksum_for_names(
        &checksum_text,
        &[
            asset_name.as_str(),
            dest_path.file_name().and_then(|s| s.to_str()).unwrap_or(""),
        ],
    )
    .ok_or_else(|| format!("Checksum not found for {}", asset_name))?;

    let temp_path = download_to_temp(&app_handle, "app-update", &url, &dest_path).await?;
    let actual = sha256_of_path(&temp_path)?;
    if actual.to_lowercase() != expected.to_lowercase() {
        let _ = fs::remove_file(&temp_path);
        return Err(format!(
            "Checksum mismatch for {} (expected {}, got {})",
            asset_name, expected, actual
        ));
    }

    move_verified_file(&temp_path, &dest_path)?;
    Ok(dest)
}
