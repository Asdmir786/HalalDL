# Plan: Limit Downloads Queue View

## Goal

Keep the Downloads queue focused by showing only the most recent 5 items, while ensuring older items remain accessible in History and no job state is lost.

## Scope

- Downloads list renders only the newest 5 jobs.
- Full job state remains in memory for progress, retries, logs, and actions.
- Overflow jobs are discoverable via History with a clear “X more in History” affordance.
- No settings added for the limit.

## Steps

1. Identify the render point for the Downloads list and apply a hard cap of 5 items without altering the underlying `jobs` state.
2. Ensure active/queued jobs are always included in the visible 5; overflow should favor hiding older done/failed items.
3. Add a compact indicator in the Downloads header or list footer that shows “+N more in History” and navigates to History on click.
4. Keep bulk actions (start all, retry failed, remove, logs) operating on full state, not the visible subset.
5. Run pnpm check.
