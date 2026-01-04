# settings.json Schema (v1)

## Location
- Stored in app data directory (per user)

## Structure

{
  "ui": {
    "theme": "dark",
    "notifications": {
      "enabled": true,
      "onComplete": true,
      "onFail": true
    }
  },

  "downloads": {
    "defaultFolder": "",
    "concurrency": 1,
    "retryCount": 2,
    "fileCollision": "skip"
  },

  "presets": {
    "defaultPresetId": "global-default"
  },

  "tools": {
    "mode": "system",
    "paths": {
      "ytDlp": "",
      "ffmpeg": "",
      "ffprobe": "",
      "aria2": "",
      "deno": ""
    },
    "useAria2": false
  }
}

## Notes
- tool mode values: "bundled" | "system" | "custom"
- fileCollision values: "skip" | "rename" | "overwrite"
