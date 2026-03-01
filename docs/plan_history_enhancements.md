# Plan: History Screen Enhancements

## Overview
Transform the History screen from a simple log into a full-featured Media Library and File Manager.

## Phase 1: Enhanced Media Experience (High Impact)
*Goal: Consume content directly without leaving the app.*

1.  **In-App Media Player**
    *   **Feature**: Play MP4, WebM, MP3, WAV files directly inside HalalDL using a modal overlay.
    *   **Details**: Custom controls (play/pause, volume, seek), playback speed, and fullscreen support.
    *   **Fallback**: gracefully handle unsupported formats (MKV) by offering to open in system player.

2.  **Grid View ("Gallery Mode")**
    *   **Feature**: Toggle between List and Grid views.
    *   **UI**: Large thumbnails with duration badges, perfect for browsing video collections visually.

## Phase 2: File Management (High Utility)
*Goal: Manage downloaded files directly from the history.*

3.  **Delete File from Disk**
    *   **Current State**: "Remove" only removes the history entry.
    *   **New Feature**: "Delete File" option that moves the actual file to Trash/Recycle Bin (and removes history entry).
    *   **Safety**: specific confirmation dialog ("Also delete file from disk?").

4.  **File Operations**
    *   **Rename**: Rename the output file directly from the UI.
    *   **Move**: Move file to a different folder.

## Phase 3: Organization & Curation
*Goal: Organize your library.*

5.  **Favorites System**
    *   **Feature**: "Heart" or "Star" items to keep them at the top or filter by them.
    *   **Filter**: Quick filter for "Favorites Only".

6.  **Custom Tags / Notes**
    *   **Feature**: Add tags (e.g., "Music", "Tutorial", "Meme") or personal notes to items.
    *   **Search**: Search capability includes these tags and notes.

## Phase 4: Advanced Metadata
*Goal: Richer information.*

7.  **Detailed Metadata View**
    *   **Feature**: "Properties" dialog showing full path, exact file size, resolution, codecs, and download logs.

8.  **Channel/Playlist Grouping**
    *   **Feature**: Smart grouping not just by domain, but by Uploader/Channel (requires parsing improvements).

## Immediate Recommended Next Steps

1.  **Implement "Delete File"**: This is a common user frustration (removing history but file remains).
2.  **Implement "Favorites"**: Simple high-value organization tool.
3.  **Implement "In-App Player"**: The "wow" factor feature.
