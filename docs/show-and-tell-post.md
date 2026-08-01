Hey everyone — I built **HalalDL**, a local-first Windows media downloader powered by yt-dlp.

### What it is
A Tauri v2 + React desktop app so you can paste a URL, pick a preset, and download without living in the terminal. No account, no telemetry.

### Highlights
- Presets for common video/audio workflows
- Visible raw yt-dlp logs (not hidden behind vague progress)
- Tray + clipboard-aware quick downloads
- Full / Lite / Portable builds
- WinGet: `winget install --id Asdmir786.HalalDL`

### Stack
- Tauri v2
- React + TypeScript + Vite
- Rust backend
- Windows 10/11 x64

### Links
- Website: https://halaldl.vercel.app
- GitHub: https://github.com/Asdmir786/HalalDL
- Latest release: https://github.com/Asdmir786/HalalDL/releases/latest

### Screenshots (1000×600 app window)

**Downloads**
![downloads](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-downloads.png)

**Presets**
![presets](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-presets.png)

**Tools**
![tools](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-tools.png)

**History**
![history](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-history.png)

**Logs**
![logs](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-logs.png)

**Settings**
![settings](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-settings.png)

**Install Trust**
![about-trust](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-about-trust.png)

**Performance**
![performance](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-settings-performance.png)

**Support prompt**
![support](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-support-prompt.png)

**Dark theme**
![downloads-dark](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-downloads-dark.png)
![logs-dark](https://raw.githubusercontent.com/Asdmir786/HalalDL/main/docs/assets/screenshots/halaldl-logs-dark.png)

### Note
Releases aren’t code-signed yet, so SmartScreen may warn on first install. Download only from GitHub Releases (SHA256SUMS included).

Happy to take feedback from the Tauri community 🙏
