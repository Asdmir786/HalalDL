# GitHub Launch Kit

This file captures the repo settings and launch copy that cannot be stored directly in git.

## Repo Metadata

- **Homepage:** `https://halaldl.vercel.app`
- **Description:** `Windows-first, local-first desktop GUI for yt-dlp with presets, raw logs, and optional bundled tools.`
- **Topics to keep:** `desktop-app`, `ffmpeg`, `open-source`, `react`, `rust`, `tauri`, `video-downloader`, `windows`, `yt-dlp`, `yt-dlp-gui`
- **Topics to consider adding:** `media-downloader`, `download-manager`, `privacy-focused`, `windows-app`

## GitHub Settings To Apply

- Enable **Discussions**
- Create categories: `Announcements`, `Q&A`, `Ideas`
- Keep **Issues** enabled
- Enable **Private vulnerability reporting**
- Keep **Releases** as the primary download funnel
- Disable **Wiki** if it stays unused
- Upload `docs/assets/social/halaldl-social-preview.png` as the repository social preview

## WinGet Update Notes

- **Current package ID:** `Asdmir786.HalalDL`
- **Current live catalog version found on March 12, 2026:** `0.3.7`
- **Current installer tracked by WinGet:** `https://github.com/Asdmir786/HalalDL/releases/download/v0.3.7/HalalDL-Full-v0.3.7-win10+11-x64-setup.exe`
- **Current official manifest path:** `manifests/a/Asdmir786/HalalDL/0.3.7/`
- **PR target repo:** `https://github.com/microsoft/winget-pkgs`

### Manual WinGet Update Flow

1. Publish the GitHub release first.
2. Confirm the final installer URL is live:
   - `https://github.com/Asdmir786/HalalDL/releases/download/v[VERSION]/HalalDL-Full-v[VERSION]-win10+11-x64-setup.exe`
3. Install WingetCreate if needed:
   - `winget install wingetcreate`
4. Update the package manifest:
   - `wingetcreate update Asdmir786.HalalDL -u https://github.com/Asdmir786/HalalDL/releases/download/v[VERSION]/HalalDL-Full-v[VERSION]-win10+11-x64-setup.exe -v [VERSION]`
5. Submit the PR to `microsoft/winget-pkgs`:
   - `wingetcreate update Asdmir786.HalalDL -u https://github.com/Asdmir786/HalalDL/releases/download/v[VERSION]/HalalDL-Full-v[VERSION]-win10+11-x64-setup.exe -v [VERSION] -t <GITHUB_PAT> --submit`

### WinGet PR Notes

- If you submit manually, the PR goes to `microsoft/winget-pkgs` targeting `main`.
- If you use `--submit`, WingetCreate can create the fork/branch/PR for you.
- WinGet validation runs after the PR opens, then Microsoft reviews and merges it.

### Automation Options

- **Yes, it can be automated.**
- The Microsoft-supported path is to run `wingetcreate update ... --submit` in CI after a release is published.
- Store the GitHub PAT as a repository secret, not in the workflow file.
- Start with manual submission first, then automate once one update succeeds cleanly.

## Release Announcement Draft

### Title

`HalalDL v[VERSION] is live: Windows-first, local-first downloads with a cleaner yt-dlp workflow`

### Body

HalalDL is a Windows-first desktop GUI for `yt-dlp` focused on a cleaner workflow, visible raw logs, and local-first privacy.

This release keeps the setup simple:

- Full build for most users
- Lite build for people who manage their own tools
- Clearer install guidance
- Better release packaging and docs

Download: https://github.com/Asdmir786/HalalDL/releases/latest

Feedback and bug reports are welcome.

## Social Post Draft

Built a Windows-first desktop GUI for `yt-dlp` called **HalalDL**.

The goal is simple: local-first downloads, visible raw logs, presets that make sense, and a cleaner setup for Windows users.

If you try it, I’d love bug reports and honest feedback more than stars.

Download: https://github.com/Asdmir786/HalalDL/releases/latest

## Outreach Notes

- Post where users already ask for Windows downloader UX, not in generic promo threads
- Lead with the user problem solved, not “please star my repo”
- Mention that the project is local-first and currently Windows-first
- Be upfront that installers are not code-signed yet

## Baseline Tracking

Record these before and 7 days after launch:

- GitHub unique visitors
- GitHub views
- Stars
- Release download counts
- New issues
- New discussions or support questions
