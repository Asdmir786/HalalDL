# Contributing to HalalDL

Thanks for helping improve HalalDL.

## Good First Contributions

- UI polish and copy improvements
- Reliability fixes around downloads, tools, or history
- Docs, onboarding, and release packaging improvements
- Bug repros with clear steps and screenshots

## Before You Start

1. Check existing issues and open pull requests.
2. Open an issue first for large changes, new features, or architectural shifts.
3. Keep changes focused. Small, reviewable PRs merge faster.

## Local Setup

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm dev
```

For Tauri or release work, you may also need Rust and Windows packaging dependencies described in the repo docs.

## Pull Request Guidelines

- Describe the problem and the user-facing change
- Link the related issue when possible
- Include screenshots or short recordings for UI changes
- Call out any packaging, installer, or release impact
- Keep release-note-worthy changes easy to summarize

## Quality Bar

Before opening a PR, run:

```bash
pnpm lint
pnpm typecheck
```

If your change touches packaging or release logic, also run:

```bash
pnpm build
pnpm cargo:check
```

## Reporting Bugs

Use the bug report form and include:

- What you expected
- What happened instead
- Steps to reproduce
- App version
- Windows version
- Relevant logs or screenshots

Please do not post secrets, cookies, or private URLs in public issues.
