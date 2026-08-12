import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { type HistoryEntry, useHistoryStore } from "@/store/history";
import { useLibraryStore } from "@/store/library";
import { renameFile } from "@/lib/commands";
import { copyText, formatJobErrorText } from "@/lib/copy-text";
import { getMarketingCaptureState } from "@/lib/demo-mode";
import { ClipMakerDialog } from "@/components/media/ClipMakerDialog";
import { DownloadDoctorDialog } from "@/components/download-doctor/DownloadDoctorDialog";
import {
  buildMediaPropertyRows,
  probeMediaFile,
  type MediaProbeInfo,
  type MediaStoredMeta,
} from "@/lib/media-properties";
import { toast } from "sonner";
import { Copy, Loader2, Pencil, Plus, Scissors, Tag, X } from "lucide-react";

export type MediaPropertiesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stored: MediaStoredMeta;
  /** When set, shows History library controls (notes/tags/rename). */
  historyEntry?: HistoryEntry | null;
  fileExists?: boolean | null;
};

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p className="mt-0.5 break-all text-sm">{value}</p>
    </div>
  );
}

function fileNameFromPath(path?: string) {
  return path ? path.split(/[\\/]/).pop() || "" : "";
}

export function MediaPropertiesDialog({
  open,
  onOpenChange,
  stored,
  historyEntry = null,
  fileExists = null,
}: MediaPropertiesDialogProps) {
  const updateNote = useHistoryStore((s) => s.updateNote);
  const addTag = useHistoryStore((s) => s.addTag);
  const removeTag = useHistoryStore((s) => s.removeTag);
  const setEntries = useHistoryStore((s) => s.setEntries);
  const entries = useHistoryStore((s) => s.entries);
  const watchlists = useLibraryStore((s) => s.watchlists);
  const collections = useLibraryStore((s) => s.collections);
  const rules = useLibraryStore((s) => s.rules);

  const probePath = open ? stored.outputPath : undefined;
  const [probeResult, setProbeResult] = useState<{
    path: string;
    info: MediaProbeInfo | null;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [filenameDraft, setFilenameDraft] = useState<string | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const [clipSession, setClipSession] = useState(0);

  const note = noteDraft ?? historyEntry?.notes ?? "";
  const newFilename = filenameDraft ?? fileNameFromPath(stored.outputPath);
  const probe =
    probeResult && probeResult.path === probePath ? probeResult.info : null;
  const probing = Boolean(probePath) && probeResult?.path !== probePath;

  useEffect(() => {
    if (!probePath) return;
    let cancelled = false;
    void probeMediaFile(probePath).then((info) => {
      if (!cancelled) setProbeResult({ path: probePath, info });
    });
    return () => {
      cancelled = true;
    };
  }, [probePath]);

  const rows = buildMediaPropertyRows(stored, probe);
  const hasMedia = rows.length > 0;
  const showLibrary = Boolean(historyEntry);
  const sourceWatchlist = historyEntry?.sourceRef?.watchlistId
    ? watchlists.find((watchlist) => watchlist.id === historyEntry.sourceRef?.watchlistId)
    : undefined;
  const sourceCollection = historyEntry?.collectionId
    ? collections.find((collection) => collection.id === historyEntry.collectionId)
    : undefined;
  const sourceRule = historyEntry?.appliedRuleId
    ? rules.find((rule) => rule.id === historyEntry.appliedRuleId)
    : undefined;
  const clipDuration = historyEntry
    ? historyEntry.mediaDurationSeconds ?? (historyEntry.duration ?? 0) / 1000
    : 0;
  const canMakeClip = Boolean(
    historyEntry?.status === "completed" && historyEntry.outputPath &&
    (fileExists || getMarketingCaptureState() === "clips") && clipDuration > 1
  );

  useEffect(() => {
    if (!open || historyEntry?.id !== "history-06-clips" || getMarketingCaptureState() !== "clips") return;
    const timer = window.setTimeout(() => setClipOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [historyEntry?.id, open]);

  const handleSaveNote = () => {
    if (!historyEntry) return;
    updateNote(historyEntry.id, note);
    toast.success("Note saved");
  };

  const handleAddTag = () => {
    if (!historyEntry || !tagInput.trim()) return;
    if (historyEntry.tags?.includes(tagInput.trim())) {
      setTagInput("");
      return;
    }
    addTag(historyEntry.id, tagInput.trim());
    setTagInput("");
  };

  const handleRename = async () => {
    if (!historyEntry?.outputPath || !newFilename.trim()) return;
    const parts = historyEntry.outputPath.split(/[\\/]/);
    parts.pop();
    const sep = historyEntry.outputPath.includes("\\") ? "\\" : "/";
    const newPath = [...parts, newFilename].join(sep);
    if (newPath === historyEntry.outputPath) {
      setIsRenaming(false);
      return;
    }
    try {
      await renameFile(historyEntry.outputPath, newPath);
      setEntries(entries.map((e) => (e.id === historyEntry.id ? { ...e, outputPath: newPath } : e)));
      toast.success("File renamed");
      setIsRenaming(false);
      setFilenameDraft(null);
    } catch {
      toast.error("Failed to rename file");
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={showLibrary ? "max-w-2xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle>Properties</DialogTitle>
        </DialogHeader>

        <div className={showLibrary ? "grid grid-cols-1 gap-6 sm:grid-cols-2" : "space-y-4"}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Media</Label>
              {probing && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Probing…
                </span>
              )}
            </div>

            {hasMedia ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rows.map((row) => (
                  <PropertyRow key={`${row.label}:${row.value}`} label={row.label} value={row.value} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {probing ? "Reading media info…" : "No media info available"}
              </p>
            )}

            {historyEntry?.failReason && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Failure</Label>
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                  <p className="whitespace-pre-wrap break-words text-sm text-destructive">
                    {historyEntry.failReason}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-8 gap-1.5 rounded-lg border-destructive/25"
                    onClick={() =>
                      void copyText(
                        formatJobErrorText({
                          title: historyEntry.title,
                          url: historyEntry.url,
                          failReason: historyEntry.failReason,
                        }),
                        "Error copied"
                      )
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy error
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-2 h-8 gap-1.5 border-destructive/25"
                    onClick={() => setDoctorOpen(true)}
                  >
                    Fix this download
                  </Button>
                </div>
              </div>
            )}

            {historyEntry && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filename</Label>
                {isRenaming ? (
                  <div className="mt-1 flex gap-2">
                    <Input
                      value={newFilename}
                      onChange={(e) => setFilenameDraft(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={() => void handleRename()}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsRenaming(false);
                        setFilenameDraft(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="group mt-1 flex items-center justify-between">
                    <p className="break-all font-mono text-sm">
                      {fileNameFromPath(historyEntry.outputPath) || "—"}
                    </p>
                    {historyEntry.outputPath && fileExists && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => setIsRenaming(true)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {historyEntry?.status === "completed" && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div><Label className="text-xs uppercase tracking-wider text-muted-foreground">Make a clip</Label><p className="mt-1 text-sm text-muted-foreground">Export a chosen part as a new local video or audio file.</p></div>
                  <Button size="sm" variant="outline" onClick={() => { setClipSession((value) => value + 1); setClipOpen(true); }} disabled={!canMakeClip} title={canMakeClip ? "Create a clip from this file" : "The original file and its duration are needed to make a clip."}><Scissors className="mr-1.5 h-3.5 w-3.5" />Make a clip</Button>
                </div>
                {!canMakeClip && <p className="mt-2 text-xs text-muted-foreground">The original file must still be on disk and have a known duration.</p>}
              </div>
            )}
          </div>

          {showLibrary && historyEntry && (
            <div className="space-y-6">
              {sourceWatchlist && (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Why this downloaded</Label>
                  <p className="mt-1 text-sm font-medium">You follow {sourceWatchlist.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sourceRule ? `Rule: ${sourceRule.name}. ` : ""}{sourceCollection ? `Saved in ${sourceCollection.name}. ` : ""}{historyEntry.presetName ? `Using ${historyEntry.presetName}.` : "Downloaded from your YouTube follow."}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                <textarea
                  className="flex min-h-[120px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Add personal notes here..."
                  value={note}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={handleSaveNote}
                />
                <p className="text-right text-[10px] text-muted-foreground">Auto-saved on blur</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tags</Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {historyEntry.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary" className="h-6 py-0.5 pl-2 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(historyEntry.id, tag)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                      placeholder="Add tag..."
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {historyEntry?.failReason && <DownloadDoctorDialog open={doctorOpen} onOpenChange={setDoctorOpen} title={historyEntry.title} url={historyEntry.url} failure={historyEntry.failReason} />}
    {historyEntry && historyEntry.outputPath && <ClipMakerDialog key={clipSession} open={clipOpen} onOpenChange={setClipOpen} entry={historyEntry} inputPath={historyEntry.outputPath} />}
    </>
  );
}
