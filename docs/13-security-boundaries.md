# Desktop security boundaries

HalalDL is a local desktop application. Its highest-risk boundary is the web
frontend's ability to request filesystem and process operations through Tauri.

## Enforced controls

- Production WebView content is restricted by the CSP in `tauri.conf.json`.
- External `halaldl:` links are parsed by one allowlist-based parser.
- Download deep links accept only credential-free HTTP(S) targets.
- A deep link queues by default; starting requires an explicit `start=1` or
  `start=start` parameter.
- The opener plugin no longer grants `/**` path access.
- The Rust `open_path` fallback requires an existing local path and does not
  pass user-controlled path text through `cmd.exe`.
- The retired desktop telemetry identifier is deleted during storage startup.

## Residual capability risk

The shell capability still allows arbitrary argument arrays for the allowlisted
yt-dlp, FFmpeg, ffprobe, aria2, Deno, and pip commands. Flexible yt-dlp and
FFmpeg presets currently require a broad argument vocabulary. The executable
names and managed locations remain allowlisted, but a future hardening pass
should move process construction behind typed Rust commands before narrowing
the argument schemas.

Filesystem read access remains broad enough to support user-selected download
folders, cookies files, media inputs, and portable data. Write operations that
can delete or rename files continue to run through explicit Rust commands and
should be treated as privileged application code.
