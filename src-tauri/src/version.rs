fn http_client(app_handle: &tauri::AppHandle) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(format!("HalalDL/{}", app_handle.package_info().version))
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())
}

async fn github_latest_tag(app_handle: &tauri::AppHandle, repo: &str) -> Result<String, String> {
    let client = http_client(app_handle)?;
    let res = client
        .get(format!(
            "https://api.github.com/repos/{}/releases/latest",
            repo
        ))
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
    Ok(tag)
}

async fn fetch_plain_version(app_handle: &tauri::AppHandle, url: &str) -> Result<String, String> {
    let client = http_client(app_handle)?;
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

#[tauri::command]
pub async fn fetch_latest_ytdlp_version(
    app_handle: tauri::AppHandle,
    channel: Option<String>,
) -> Result<String, String> {
    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";
    let repo = if is_nightly {
        "yt-dlp/yt-dlp-nightly-builds"
    } else {
        "yt-dlp/yt-dlp"
    };
    let tag = github_latest_tag(&app_handle, repo).await?;
    Ok(tag.trim_start_matches('v').trim().to_string())
}

#[tauri::command]
pub async fn fetch_latest_aria2_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    let tag = github_latest_tag(&app_handle, "aria2/aria2").await?;
    Ok(tag
        .trim_start_matches("release-")
        .trim_start_matches('v')
        .trim()
        .to_string())
}

#[tauri::command]
pub async fn fetch_latest_deno_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    let version = fetch_plain_version(&app_handle, "https://dl.deno.land/release-latest.txt").await?;
    Ok(version.trim_start_matches('v').trim().to_string())
}

#[tauri::command]
pub async fn fetch_latest_ffmpeg_version(
    app_handle: tauri::AppHandle,
    channel: Option<String>,
) -> Result<String, String> {
    let is_nightly = channel.as_deref().unwrap_or("stable") == "nightly";
    let url = if is_nightly {
        "https://www.gyan.dev/ffmpeg/builds/git-version"
    } else {
        "https://www.gyan.dev/ffmpeg/builds/release-version"
    };
    fetch_plain_version(&app_handle, url).await
}
