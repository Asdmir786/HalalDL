export function parseTimecodeToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length > 3) return null;

  let total = 0;
  for (const part of parts) {
    if (!/^\d+(?:\.\d+)?$/.test(part)) return null;
    total = total * 60 + Number(part);
  }

  return Number.isFinite(total) ? total : null;
}

export function buildClipSection(startTime: string | undefined, endTime: string | undefined): string | null {
  const start = startTime?.trim() ?? "";
  const end = endTime?.trim() ?? "";
  if (!start && !end) return null;

  const startSeconds = start ? parseTimecodeToSeconds(start) : 0;
  const endSeconds = end ? parseTimecodeToSeconds(end) : null;
  if (startSeconds === null || (end && endSeconds === null)) return null;
  if (endSeconds !== null && endSeconds <= startSeconds) return null;

  return `*${start || "0"}-${end || "inf"}`;
}
