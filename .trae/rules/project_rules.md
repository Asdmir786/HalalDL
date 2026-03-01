# Code Structure & Modularity

## File size guidelines

- **Aim for 150–400 lines per file.** This is a guideline, not a hard limit.
- If a file exceeds ~500 lines, look for natural seams to split (distinct responsibilities, separable types, large data arrays).
- Do **not** create a new file for every small helper, type, or constant. A handful of related one-liners belong together in a shared module.

## When to split

- A component file contains multiple large sub-components → extract into a `components/` subfolder.
- A file mixes business logic hooks with UI rendering → separate hooks into a `hooks/` subfolder.
- A large static data array (presets, constants >80 lines) lives inline → move to a dedicated data file.
- A Rust module has multiple unrelated command groups → split by domain (e.g., `download.rs`, `version.rs`).

## When NOT to split

- A file is under ~300 lines and everything in it is closely related — leave it alone.
- A helper is only used by one file and is <30 lines — keep it co-located.
- Splitting would force circular imports or excessive prop-drilling.

## Directory conventions

- When splitting a file `foo.ts` into a folder, create `foo/index.ts` (barrel) that re-exports the public API so external imports stay unchanged.
- Group by feature, not by file type (e.g., `screens/tools/{components,hooks,constants}` not `components/tools/`, `hooks/tools/`).

## Imports

- Prefer importing from barrel `index.ts` files, not deep internal paths from other features.
- Internal helpers that are not part of the public API should **not** be exported from the barrel.

# Process Stop Safety

- Do not terminate or interrupt a running process unless both conditions are true:
  - At least 3 minutes have elapsed since the process started.
  - No new output/progress has appeared during that period.
- Before stopping any process, re-read the terminal output to confirm it is truly stalled.
- Prefer continued polling with reasonable backoff when status is uncertain.
- If termination is necessary, explain the stall evidence before stopping.

# Node 22 Only

- Use Node.js `22.x` for all project commands, installs, and CI guidance.
- Do not suggest or apply upgrades to Node 23/24/25+ for this repo.
- Keep `@types/node` on `^22` to match runtime APIs.
- If a package suggests newer Node features, prefer a compatible package version rather than changing Node major.
- Mention Node-version compatibility when recommending dependency updates.

# Current-Year Knowledge Rule

- For time-sensitive or external facts (tool versions, API changes, release notes, docs behavior), verify with live web sources before answering.
- Prefer official sources first (project docs, GitHub releases, vendor docs), then secondary sources if needed.
- Do not rely only on model memory for "latest/current" questions.
- Include a brief note of what was checked (source + date relevance) when providing version/release guidance.
- If web access is unavailable, explicitly say so and label any version/date details as potentially stale.

# Verification Standard

- Use `pnpm check` as the default verification command after substantive code changes.
- Treat `pnpm check` as the primary validation step before reporting work complete.
- If `pnpm check` cannot run (environment/tooling issue), report why and run the closest subset checks possible (for example `pnpm lint`, `pnpm typecheck`, or `pnpm cargo:check`).
- Include a short note in the response stating whether verification was run and the result.

# Planning Mode Required

- Do not make any code changes until I explicitly approve a plan.
- Always produce a written plan first and wait for my “yes”.
- After approval, wait for my explicit “execute” before making edits.
- Always bypass the plan/execute gates, if asked to override them.
- Maintain a plan document in docs/ (update it as the plan changes).
- Do not create any other files unless I explicitly ask.
