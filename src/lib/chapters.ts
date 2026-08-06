export type ChapterMode = "preserve" | "split";

export interface MediaChapter {
  title: string;
  startTime: number;
  endTime?: number;
}

export function appendChapterArgs(args: string[], mode: ChapterMode | undefined, hasChapters?: boolean) {
  if (!mode || !hasChapters) return;
  if (mode === "split") args.push("--split-chapters");
  else args.push("--embed-chapters");
}
