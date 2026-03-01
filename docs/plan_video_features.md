# Plan: Video Playback & Features

## Goal

Enhance the history screen with video playback capabilities and improve file management experience.

## Scope

- Add a visible "Play" button to history items.
- Ensure "File removed" indicator works correctly (already fixed permissions).
- Verify file operations (open, reveal, delete) work as expected.

## Steps

1.  **Fix "File removed" issue**:
    - [x] Analyze `HistoryScreen.tsx` logic.
    - [x] Identify missing `fs` permissions in `src-tauri/capabilities/default.json`.
    - [x] Add `fs:allow-home-read-recursive` and related permissions.
    - [x] Verify with `pnpm check`.

2.  **Add Play Button**:
    - [x] Update `HistoryItem.tsx` to include a `Play` button in the hover actions.
    - [x] Use `lucide-react`'s `Play` icon.
    - [x] Link it to `handleOpen` (which uses system default player).
    - [x] Add "Play" to context menu as well (rename "Open File" to "Play / Open").

3.  **Verification**:
    - [x] Run `pnpm check` (passed).
    - [ ] Manual verification by user (check if "File removed" is gone and Play button works).

## Future Considerations (Not in this immediate scope)

- **In-App Player**: Implementing a custom video player modal for supported formats (mp4, webm).
- **Transcoding**: Support for non-web-friendly formats.
