# settings.json Schema (v1)

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
