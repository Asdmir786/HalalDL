import { Clock3, ImageOff, Languages, Layers, LoaderCircle } from "lucide-react";
import type { MediaMetadataProbe } from "@/lib/downloader";
import { formatBytes, formatMediaDuration } from "../utils";

export type UrlPreviewStatus = "idle" | "loading" | "ready" | "error";

interface UrlInfoPreviewProps {
  status: UrlPreviewStatus;
  preview: MediaMetadataProbe | null;
  errorMessage?: string | null;
}

export function UrlInfoPreview({ status, preview, errorMessage }: UrlInfoPreviewProps) {
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/82 px-3 py-2.5 text-[11px] text-muted-foreground dark:border-white/8 dark:bg-background/65"
      >
        <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-300" />
        <span>Fetching title, thumbnail, and available qualities…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        aria-live="polite"
        className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-[11px] text-amber-800 dark:text-amber-200"
      >
        <p className="font-medium">Could not load preview</p>
        <p className="mt-0.5 opacity-90">
          {errorMessage?.trim() || "The link may still download. Try adding it anyway."}
        </p>
      </div>
    );
  }

  if (!preview) return null;

  const durationLabel = formatMediaDuration(preview.mediaDurationSeconds);
  const collection = preview.mediaCollectionSummary;
  const qualityLabels = preview.formats.map((format) => {
    const size = formatBytes(format.filesizeBytes);
    const note = format.note ? ` · ${format.note}` : "";
    const sizeText = size ? ` · ${size}` : "";
    return {
      id: format.id,
      text: `${format.label}${note}${sizeText}`,
    };
  });

  return (
    <div
      aria-live="polite"
      className="overflow-hidden rounded-xl border border-border/60 bg-background/82 shadow-sm dark:border-white/8 dark:bg-background/65"
    >
      <div className="flex gap-3 p-2.5">
        <div className="relative h-[72px] w-[128px] shrink-0 overflow-hidden rounded-lg bg-muted/60">
          {preview.thumbnailUrl && /^https?:/i.test(preview.thumbnailUrl) ? (
            <img
              src={preview.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-4 w-4" />
            </div>
          )}
          {durationLabel ? (
            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {durationLabel}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {preview.title || "Untitled media"}
            </p>
            {preview.uploader ? (
              <p className="truncate text-[11px] text-muted-foreground">{preview.uploader}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {durationLabel ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {durationLabel}
              </span>
            ) : null}
            {collection ? (
              <span className="inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {collection.kind === "carousel"
                  ? `Carousel · ${collection.totalItems} items`
                  : "Single post"}
              </span>
            ) : null}
            {(preview.hasManualSubtitles || preview.hasAutoSubtitles) && (
              <span className="inline-flex items-center gap-1">
                <Languages className="h-3 w-3" />
                Subtitles
                {preview.availableSubtitleLanguages.length > 0
                  ? ` (${preview.availableSubtitleLanguages.slice(0, 4).join(", ")}${
                      preview.availableSubtitleLanguages.length > 4 ? "…" : ""
                    })`
                  : ""}
              </span>
            )}
          </div>

          {qualityLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {qualityLabels.map((quality) => (
                <span
                  key={quality.id}
                  className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-foreground/85 dark:border-white/10 dark:bg-white/5"
                >
                  {quality.text}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {collection
                ? "Instagram keeps original files; presets only affect video items."
                : "Qualities will be chosen by your preset when the download starts."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
