import { MediaPropertiesDialog } from "@/components/media/MediaPropertiesDialog";
import { type HistoryEntry } from "@/store/history";

interface HistoryDetailsProps {
  entry: HistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileExists: boolean | null;
}

/** @deprecated Prefer MediaPropertiesDialog; kept as History adapter. */
export function HistoryDetails({ entry, open, onOpenChange, fileExists }: HistoryDetailsProps) {
  if (!entry) return null;

  return (
    <MediaPropertiesDialog
      open={open}
      onOpenChange={onOpenChange}
      stored={{
        title: entry.title,
        url: entry.url,
        outputPath: entry.outputPath,
        fileSize: entry.fileSize,
        mediaDurationSeconds: entry.mediaDurationSeconds ?? entry.duration,
        format: entry.format,
        domain: entry.domain,
        presetName: entry.presetName,
        downloadedAt: entry.downloadedAt,
        failReason: entry.failReason,
      }}
      historyEntry={entry}
      fileExists={fileExists}
    />
  );
}
