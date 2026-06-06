# HalalDL Growth, Trust, And v0.5.1 Plan

This document captures the current state of HalalDL, the trust/distribution problem, the in-app support changes already added, and the recommended work before publishing the next release.

## Current State

HalalDL is a real released Windows app, not just a prototype.

- Current public release: `v0.5.0`
- Current branch state when this plan was written: `main` contains post-`v0.5.0` support and trust improvements
- Current public positioning: Windows-first, local-first desktop GUI for `yt-dlp`
- Primary platform: Windows 10 and Windows 11, x64
- Distribution today: GitHub Releases and WinGet
- Latest release asset signal: the Full setup EXE is the strongest download path

Important distinction: GitHub release download counts are **asset downloads**, not unique users. One person can download more than one asset or download the same asset more than once. Still, the Full setup EXE having more than 100 downloads is meaningful directional signal.

## The Main Problem

HalalDL does not mainly have a “make noise” problem. It has a **trust and discoverability** problem.

Windows users need to feel safe enough to install the app before broader promotion can work. Because HalalDL is currently unsigned, Windows SmartScreen may warn users on first run. That warning is scary to normal users, even if the app is open source and the release files are legitimate.

The practical goal is:

> Get the first serious group of Windows users to trust HalalDL enough to install it, use it, and leave feedback.

## Code Signing Reality

Code signing is not just a technical switch. It usually requires identity verification.

There are two separate issues:

1. **Publisher identity**
   - A code signing certificate proves who published the executable.
   - This can require a registered business, government ID, region eligibility, address validation, phone callback, or other identity checks.

2. **SmartScreen reputation**
   - Signing does not always instantly remove SmartScreen warnings.
   - Reputation builds over time through trusted downloads and usage.

For now, HalalDL should not depend on code signing as the only trust strategy.

The current trust strategy is:

- Keep releases public and transparent
- Build releases through GitHub Actions
- Publish SHA256 checksums
- Route users to official GitHub Releases
- Explain SmartScreen honestly
- Make verification easy
- Use package managers and directories as trust/discovery bridges

## What Was Already Changed

### Support Prompts

HalalDL now has gentle in-app support prompts.

Files:

- `src/screens/settings/components/AboutSection.tsx`
- `src/screens/history/HistoryScreen.tsx`
- `src/lib/runtime-flags.ts`

Behavior:

- The prompt appears only after **3 completed downloads**
- It appears in Settings/About and as a small History footer
- It does not appear on first launch
- It does not interrupt downloads
- It does not use a modal or forced popup
- It stores dismissal locally

Actions:

- **Star** opens the GitHub repository
- **Feedback** opens the GitHub issue chooser
- **Not now** dismisses the prompt

Once the user clicks Star, Feedback, or Not now, the prompt stops showing.

Why this matters:

- It asks only after the app has provided value
- It gives users a simple way to support the project
- It can increase GitHub stars and feedback without feeling desperate

### Trust And Distribution Docs

The README and docs were updated to explain:

- Full vs Lite vs Portable
- Full setup EXE as the recommended default
- SmartScreen and unsigned releases
- SHA256 verification
- Distribution priorities

Files:

- `README.md`
- `docs/06-packaging-lite-full.md`
- `docs/07-release-checklist.md`
- `docs/08-packaging.md`
- `docs/11-distribution-and-trust-plan.md`
- `docs/RELEASE_TEMPLATE.md`

## What Users Will See After The Next Release

Important: users downloading `v0.5.0` will not see the new support prompts. The new in-app changes are on `main` and require a new release, likely `v0.5.1`.

After `v0.5.1`, users who complete at least 3 downloads will see:

- A support card in Settings/About
- A support footer in History when history results are visible
- Buttons for Star, Feedback, and Not now

The prompts are intentionally low-pressure.

## What To Do Before Releasing v0.5.1

Do not release immediately. First, finish the trust and feedback loop.

Recommended order:

1. Add Copy Diagnostics
2. Add Install Trust card in About
3. Polish Feedback flow
4. Update release notes for v0.5.1
5. Run checks
6. Publish v0.5.1

## Change 1: Copy Diagnostics

Add a button in Settings/About called **Copy Diagnostics**.

It should copy useful support information to the clipboard so users can paste it into GitHub issues.

Suggested data:

- HalalDL version
- app mode: Full, Lite, or Portable
- package type: MSI, NSIS, Portable ZIP, or unknown
- OS information if available
- tool statuses and versions
- active download count
- total history count
- completed history count
- failed history count

Why this matters:

- Feedback becomes easier for users
- Bug reports become much more useful
- It pairs naturally with the new Feedback buttons

Suggested format:

```text
HalalDL diagnostics
Version: 0.5.1
Mode: Full
Package: NSIS
OS: Windows 11 x64
Active downloads: 0
History: 12 total, 11 completed, 1 failed

Tools:
- yt-dlp: Detected, 2026.xx.xx
- ffmpeg: Detected, 7.x
- aria2: Missing
- deno: Detected, 2.x
```

## Change 2: Install Trust Card

Add a small card in Settings/About explaining the install trust situation.

Suggested title:

```text
Install Trust
```

Suggested content:

```text
Official HalalDL downloads come from GitHub Releases.
Releases are currently unsigned, so Windows SmartScreen may appear.
Verify downloaded files with SHA256SUMS.txt when needed.
```

Suggested buttons:

- Open latest release
- Open code signing policy

Why this matters:

- It gives users a clear answer when SmartScreen appears
- It reinforces the official download source
- It makes the project look more serious and transparent

## Change 3: Feedback Flow Polish

The current Feedback button opens the GitHub issue chooser. That is good, but the next version should make feedback easier.

Recommended first polish:

- Add Copy Diagnostics near Feedback
- Keep Feedback opening the issue chooser
- Do not require login or add an in-app feedback form yet

Avoid:

- Popups after every download
- Asking for stars on first launch
- Blocking users until they rate or review
- Asking for reviews inside active download cards

## Change 4: v0.5.1 Release Notes

The next release should be framed as a small trust and feedback release.

Possible title:

```text
v0.5.1 - The Trust And Feedback Update
```

Include:

- New GitHub star and feedback prompts after real usage
- Clearer Full/Lite/Portable guidance
- Better install trust docs
- SHA256 verification guidance
- Copy Diagnostics if added before release
- No code signing yet, with SmartScreen explanation

## Verification Before Release

Run:

```bash
pnpm typecheck
pnpm lint
```

If Rust is available:

```bash
pnpm cargo:check
```

In the current local environment, `cargo` was not available, so Rust-side checking could not run locally. GitHub Actions should still run the Windows release build path when publishing.

## Distribution Order After v0.5.1

After publishing `v0.5.1`, distribute in this order:

1. GitHub Releases
2. WinGet update
3. Scoop submission
4. Chocolatey package preparation/submission
5. AlternativeTo listing
6. Short YouTube install and verification video
7. Reddit feedback post
8. Hacker News Show HN later, after the trust flow is stronger

## YouTube Plan

YouTube should be used for searchable tutorials, not hype.

First videos:

1. `How to Install HalalDL on Windows 11 and Verify SHA256`
2. `HalalDL Full vs Lite vs Portable`
3. `Portable yt-dlp GUI for Windows`
4. `How to Read yt-dlp Errors Without Using the Terminal`

Keep videos short and honest. Show SmartScreen if it appears. Do not hide the unsigned state.

## Reddit Plan

Use Reddit for honest feedback, not spam.

Suggested post angle:

```text
I built a Windows-first local yt-dlp GUI and need feedback on the install/trust flow.
```

Talk about:

- Why the app exists
- That it is unsigned for now
- That SHA256 verification is available
- That feedback on trust and installer UX is especially useful

Avoid:

- Begging for stars
- Posting the same thing in many communities
- Marketing it as a way to violate platform terms

## Positioning

Do not position HalalDL as just another “free YouTube downloader.”

Better positioning:

```text
HalalDL is a Windows-first, local-first desktop GUI for yt-dlp with presets, raw logs, and Full/Lite/Portable builds.
```

Core proof points:

- No account
- No telemetry
- Local-first
- Transparent logs
- Beginner-friendly presets
- Portable option
- GitHub Releases and checksums

## What Not To Do Yet

Do not prioritize these before v0.5.1:

- Microsoft Store
- Paid ads
- Big Product Hunt launch
- Random cheap code signing certificate
- Aggressive in-app popups

The app needs trust, clear install guidance, and better feedback first.

## The Simple Roadmap

### Now

- Add Copy Diagnostics
- Add Install Trust card
- Polish Feedback flow

### Next Release

- Publish `v0.5.1`
- Update WinGet
- Share the release carefully

### After Release

- Submit to Scoop
- Prepare Chocolatey
- Submit AlternativeTo listing
- Record install/SHA256 video
- Post one honest Reddit feedback thread

## Success Metrics

Track before and after `v0.5.1`:

- GitHub stars
- Release downloads
- Full setup EXE downloads
- Portable ZIP downloads
- GitHub issues opened
- Useful feedback received
- WinGet version freshness
- Website clicks to GitHub Releases

The short-term goal is not mass fame. The short-term goal is:

> More real Windows users install HalalDL, understand why SmartScreen appears, trust the official download path, and know how to leave useful feedback.
