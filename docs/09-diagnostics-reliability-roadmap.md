# Diagnostics + Reliability Roadmap (vNext)

This document is a concrete implementation plan for:
- A proper diagnostics export bundle (ZIP) for support/debugging
- Better, collision-resistant job IDs
- Flexible checksum verification + retry for tool downloads
- A short backlog of high-impact UX improvements already identified

It is written against the current architecture:
- Frontend state persisted via `@tauri-apps/plugin-store` JSON stores ([src/lib/storage.ts](../src/lib/storage.ts))
- Backend exposes filesystem + tool commands via Tauri commands ([src-tauri/src/lib.rs](../src-tauri/src/lib.rs), [src-tauri/src/file_commands.rs](../src-tauri/src/file_commands.rs), [src-tauri/src/tools.rs](../src-tauri/src/tools.rs))
- Tool binaries live in `AppData/bin` (Windows) and are resolved first ([src/lib/downloader/tool-env.ts](../src/lib/downloader/tool-env.ts))

---

## 1) Diagnostics Export (ZIP)

### Goals
- Produce a single ZIP file that can be attached to an issue and reproduced locally.
- Avoid requiring the user to manually copy/paste logs, tool versions, and settings.
- Provide safe defaults: redact sensitive values by default, with an explicit opt-in for full details.

### UX
Add a single “Diagnostics” entry point in the UI:
- Primary location: Logs screen header action (near Export/Copy) ([src/screens/LogsScreen.tsx](../src/screens/LogsScreen.tsx))
- Secondary location: Settings → About (optional)

Dialog options:
- Include: logs, tools status, settings/presets snapshot, current queue snapshot, history summary
- Redaction level:
  - Default: redact URLs (keep domain), redact local filesystem paths, redact cookies/headers if present in logs
  - Advanced toggle: include full URLs and full paths (for power users)

Output naming:
- Default file name: `HalalDL-diagnostics-YYYY-MM-DD_HH-mm-ss.zip`

### ZIP contents (proposed)
All files stored under a folder prefix inside the zip:
- `HalalDL-diagnostics/manifest.json`
- `HalalDL-diagnostics/app-info.json`
- `HalalDL-diagnostics/build-info.json`
- `HalalDL-diagnostics/tools-status.json`
- `HalalDL-diagnostics/settings.json`
- `HalalDL-diagnostics/presets.json`
- `HalalDL-diagnostics/download-queue.json`
- `HalalDL-diagnostics/history-summary.json`
- `HalalDL-diagnostics/logs.txt`

Where:
- `manifest.json`: schema version, createdAt, redaction flags, file list + sizes + sha256 (optional)
- `app-info.json`: app version, Tauri version (if available), OS info, locale
- `build-info.json`: `VITE_APP_MODE`, commit hash if embedded, feature flags
- `tools-status.json`: detected tools, versions, variants, paths, backups
- `settings.json`/`presets.json`: exported snapshots from store
- `download-queue.json`: current jobs list (ids, url redacted, status/progress, outputDir, overrides)
- `history-summary.json`: counts and selected fields; optionally include full history if user opts in
- `logs.txt`: exported console output (existing export logic can be reused) ([src/screens/LogsScreen.tsx](../src/screens/LogsScreen.tsx))

### Implementation approach
Use the backend to create the ZIP (no new frontend zip library):
- Rust already depends on `zip` ([src-tauri/Cargo.toml](../src-tauri/Cargo.toml))
- Frontend gathers current state and passes it as JSON payload to a new Tauri command

Proposed new command:
- `export_diagnostics_zip(app_handle, output_path: String, payload: DiagnosticsPayload) -> Result<String, String>`
  - Writes the zip
  - Returns the final path

New backend module:
- `src-tauri/src/diagnostics.rs`
  - Zip writer helpers
  - Redaction helpers (if redaction is performed on backend)

Where to wire it:
- Register command in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs)

Frontend payload assembly:
- Create `src/lib/diagnostics/buildDiagnosticsPayload.ts`
  - Pull from stores:
    - logs: `useLogsStore.getState()`
    - tools: `useToolsStore.getState()`
    - settings: `useSettingsStore.getState()`
    - presets: `usePresetsStore.getState()`
    - downloads: `useDownloadsStore.getState()`
    - history: `useHistoryStore.getState()`
  - Redact values based on UI selection
  - Keep this as pure functions for easy unit tests

Saving destination:
- Use `@tauri-apps/plugin-dialog` `save()` to pick destination path in UI (same pattern as current exports).

### Redaction rules (default)
URLs:
- Replace full URL with:
  - `domain/path` (no query string) or just `domain`
  - Example: `https://www.youtube.com/watch?v=abc&list=xyz` → `youtube.com/watch`

Paths:
- Replace `C:\Users\name\...` with `C:\Users\…`
- Replace app data paths with `%APPDATA%/...` when detected

Logs:
- Strip obvious secrets if present:
  - `Authorization: ...`
  - `Cookie: ...`
  - `--cookies ...` argument paths

### Acceptance criteria
- Export creates a ZIP that opens on Windows without external tools.
- The bundle contains at least: app-info, tools-status, settings/presets, logs, download queue.
- Default export does not contain full URLs or user directory names.
- Export succeeds even if some fields are unavailable (best-effort, never crash).

### Tests
- Unit tests in frontend for redaction functions (string → redacted string).
- Backend smoke test: create zip to a temp dir and verify expected entries exist.

---

## 2) Better Job IDs (no collisions)

### Current
Jobs currently use a short `Math.random().toString(36)` id ([src/store/downloads.ts](../src/store/downloads.ts)).

### Goal
Make job ids globally unique, stable, and safe to use as filenames/keys.

### Recommendation (no new dependency)
Use `crypto.randomUUID()` when available (Tauri webview supports modern Web APIs).
Fallback:
- `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

### Implementation steps
1. Create `src/lib/id.ts` with `createId()` returning a string id.
2. Replace job id creation in [src/store/downloads.ts](../src/store/downloads.ts) with `createId()`.
3. If any other entity uses random ids (history entries, presets copies), migrate them to `createId()` as well.

### Acceptance criteria
- IDs are never empty, never repeat in stress tests (10k creations).
- No UI regressions: selecting jobs, log filtering, history linking all still work.

---

## 3) Flexible checksum verification + retry (tools)

### Current
- Tools download logic lives in [src-tauri/src/tools.rs](../src-tauri/src/tools.rs).
- Retries exist for network downloads in `download.rs`, but checksum mismatch behavior is inconsistent across tools.
- `yt-dlp` and `ffmpeg` now retry on checksum mismatch; `deno` and `aria2` are not fully aligned.

### Goals
- One shared pipeline for:
  - download → checksum fetch → verify → install/replace
- Retry policy:
  - Network failure retry
  - Checksum mismatch retry (delete temp file, retry download)
  - Hard fail after N attempts with clear message

### Proposed refactor (backend)
Add a helper in `tools.rs` or a new module `download_pipeline.rs`:
- `download_with_checksum_retry(tool, url, checksum_source, verify_target, dest_path) -> Result<PathBuf, String>`

Inputs:
- `tool`: tool id string for progress emission
- `url`: download url
- `checksum_source`: optional function returning `(expected_hash, expected_filename)` or just `expected_hash`
- `verify_target`:
  - `DownloadedFile` (verify zip/7z/exe)
  - `ExtractedFile` (verify extracted exe) when upstream publishes hashes for the exe name

Behavior:
- Up to `MAX_DOWNLOAD_RETRIES` attempts
- On mismatch:
  - remove temp file
  - emit status `"Checksum mismatch, retrying (X/N)"`
  - retry

Tool-specific notes:
- `deno`:
  - Prefer verifying the downloaded zip by filename (use the `.sha256sum` list to find the zip’s hash).
  - This avoids ambiguity around `deno.exe` (which is inside the zip and is not what upstream usually lists).
- `aria2`:
  - If upstream doesn’t provide a stable checksum endpoint, keep “no checksum” mode but still keep network retry.
  - Optionally: pin to a version + checksum later (requires a maintained mapping).

### Acceptance criteria
- All tools follow the same retry behavior and user-visible progress pattern.
- `deno` verification uses the zip checksum (if available).
- Any failure returns an actionable error message (tool id + expected/got hash).

---

## 4) Small backlog (high impact)

These are not required for the diagnostics bundle, but are recommended “vNext” items.

### A) History: Delete file from disk
Status: backend already supports `delete_file` ([src-tauri/src/file_commands.rs](../src-tauri/src/file_commands.rs)) and frontend already tracks `outputPath` in history entries ([src/store/history.ts](../src/store/history.ts)).

Plan:
- Add “Delete file” action in history item menu
- Confirm dialog explaining it deletes the actual file
- If delete succeeds: keep history entry but mark `fileExists=false` OR optionally remove entry (your call)

### B) Downloads: Drag-and-drop reorder queue
Docs mention it as a target UX ([docs/03-ui.md](03-ui.md)).

Plan:
- Keep a stable `order` field on queued jobs
- Only allow reorder for `Queued` jobs (not active)
- Virtualized list: implement reorder via “move up/down” controls first, then true drag-and-drop

### C) Export/import “job template”
Plan:
- Export selected job(s) to JSON containing url + preset snapshot + overrides
- Import adds them to queue

### D) Backend startup robustness (remove `unwrap()` crashes)
Replace `unwrap()` calls in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs) with best-effort behavior so startup never panics.

---

## Milestones

### Milestone 1: Diagnostics ZIP MVP
- Backend zip command + frontend dialog + redaction defaults
- Includes: logs, tools status, settings/presets, download queue, app info

### Milestone 2: Reliability polish
- Job IDs switched to `createId()`
- Unified checksum retry pipeline for all tools (including Deno)

### Milestone 3: UX extras
- History delete-file action
- Job template import/export
- Queue reorder controls (non-drag first)

