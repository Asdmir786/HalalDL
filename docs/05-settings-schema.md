# settings.json Schema (v1)

## Location
- Stored in app data directory (per user)

## Structure

{
  "theme": "system",
  "accentColor": "default",
  "notifications": true,

  "maxConcurrency": 2,
  "maxRetries": 3,
  "maxSpeed": 0,
  "fileCollision": "rename",

  "defaultDownloadDir": "",
  "tempDir": "",

  "autoClearFinished": false,
  "autoCopyFile": true,
  "downloadsAddMode": "queue",
  "downloadsSelectedPreset": "default",

  "historyRetention": 0
}

## Notes
- maxSpeed is in KB/s (0 = unlimited)
- downloadsAddMode values: "queue" | "start"
- fileCollision values: "skip" | "rename" | "overwrite"
