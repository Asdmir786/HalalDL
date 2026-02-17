#[tauri::command]
pub async fn fetch_latest_ytdlp_version(app_handle: tauri::AppHandle, channel: Option<String>) -> Result<String, String> {
    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";
    let repo = if is_nightly {
        "yt-dlp/yt-dlp-nightly-builds"
    } else {
        "yt-dlp/yt-dlp"
    };

    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(format!("https://api.github.com/repos/{}/releases/latest", repo))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let tag = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if tag.is_empty() {
        return Err("Missing tag_name".to_string());
    }

    Ok(tag.trim_start_matches('v').trim().to_string())
}

#[tauri::command]
pub async fn fetch_latest_aria2_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.github.com/repos/aria2/aria2/releases/latest")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let tag = json
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if tag.is_empty() {
        return Err("Missing tag_name".to_string());
    }

    Ok(tag
        .trim_start_matches("release-")
        .trim_start_matches('v')
        .trim()
        .to_string())
}

#[tauri::command]
pub async fn fetch_latest_deno_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://dl.deno.land/release-latest.txt")
        .header("Accept", "text/plain,*/*")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let version = text.trim().split_whitespace().next().unwrap_or("").trim();
    if version.is_empty() {
        return Err("Empty response".to_string());
    }
    Ok(version.trim_start_matches('v').trim().to_string())
}

#[tauri::command]
pub async fn fetch_latest_ffmpeg_version(app_handle: tauri::AppHandle, channel: Option<String>) -> Result<String, String> {
    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";
    let url = if is_nightly {
        "https://www.gyan.dev/ffmpeg/builds/git-version"
    } else {
        "https://www.gyan.dev/ffmpeg/builds/release-version"
    };

    let client = reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(url)
        .header("Accept", "text/plain,*/*")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let text = res.text().await.map_err(|e| e.to_string())?;
    let version = text.trim().split_whitespace().next().unwrap_or("").trim();
    if version.is_empty() {
        return Err("Empty response".to_string());
    }
    Ok(version.to_string())
}
