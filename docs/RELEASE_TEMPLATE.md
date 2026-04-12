<!--
AI GENERATION INSTRUCTIONS:
When asked to generate release notes based on this template, ALWAYS format your final response exactly as follows:

Release image rules:
- ALWAYS prepare separate light-mode and dark-mode release images. Do not use a single mixed-theme image.
- Name release images with explicit `-light` and `-dark` suffixes, for example `hero-light.png` and `hero-dark.png`.
- In release notes, include both variants or clearly choose the right variant for the target surface.
- Do not rely on flaky browser screenshots if they produce overlapping UI, captured unrelated windows, or mixed theme output.
- Prefer a deterministic generator such as `docs/assets/releases/[VERSION]/generate-images.py` using Python/Pillow, or an equally reproducible script, so images can be regenerated cleanly.
- Before finalizing, visually inspect at least the hero image and every feature image referenced in release notes.

**Version**: vX.Y.Z
**Title**: vX.Y.Z - The [Theme] Update

**Description**:
```markdown
## ⚡ The "[Theme]" Update!
[...Rest of the release notes content...]
```
-->

# v[VERSION] - The [Theme] Update

Released: YYYY-MM-DD

## ⚡ The "[Theme]" Update!

[A friendly, enthusiastic paragraph summarizing the main focus of the update. Mention the 1-2 biggest changes and the overall goal (speed, stability, beauty, etc.).]

![Release hero - light](../assets/releases/[VERSION]/promo/hero-light.png)
![Release hero - dark](../assets/releases/[VERSION]/promo/hero-dark.png)

## ✨ What’s New in v[VERSION]?

### [Emoji] [Feature Category 1]

*   **[Feature Name]**: [Description of the feature. Focus on the user benefit.]
*   **[Feature Name]**: [Description of the feature.]

### [Emoji] [Feature Category 2]

*   **[Feature Name]**: [Description of the feature.]

![Feature spotlight - light](../assets/releases/[VERSION]/promo/[feature-image]-light.png)
![Feature spotlight - dark](../assets/releases/[VERSION]/promo/[feature-image]-dark.png)

## 🐛 Fixes & Improvements

*   **[Area]**: [Description of the fix.]
*   **[Area]**: [Description of the fix.]

## 📦 Choosing Your Version

*   **Full (Recommended)**: Best for most users. Includes all dependencies (FFmpeg, yt-dlp, etc.) pre-configured.
*   **Lite**: Best for power users who manage their own tools.

## ⚠️ Known Notes

*   **[Platform or release note]**: [Any platform-specific note, limitation, or small caveat worth calling out.]
*   **Release images**: [Confirm that light-mode and dark-mode release images are included separately.]

## ⬆️ Upgrade Notes

*   [Anything users should do after installing, migrating, or updating.]

## 📝 Note from the Developer

[A short personal note explaining the "why" behind the update or a thank you to users.]

---

Full Changelog: [vPREV_VERSION...vVERSION](https://github.com/Asdmir786/HalalDL/compare/v[PREV_VERSION]...v[VERSION])
Built with ❤️ using Tauri, React, and Rust.
