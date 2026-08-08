import { useMemo, useState } from "react";
import { Loader2, Music2, Scissors, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportLocalClip, getStoredChapters } from "@/lib/local-clips";
import { type HistoryEntry } from "@/store/history";
import { toast } from "sonner";

type ClipMakerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: HistoryEntry;
  inputPath: string;
};

function formatTime(value: number): string {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ClipMakerDialog({ open, onOpenChange, entry, inputPath }: ClipMakerDialogProps) {
  const duration = entry.mediaDurationSeconds ?? (entry.duration ?? 0) / 1000;
  const chapters = useMemo(() => getStoredChapters(entry), [entry]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(duration, 60));
  const [name, setName] = useState(`${entry.title} - clip`);
  const [audioOnly, setAudioOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  const validRange = Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= duration;
  const handleExport = async () => {
    if (!validRange) return;
    setExporting(true);
    try {
      const clip = await exportLocalClip({ entry, inputPath, startSeconds: start, endSeconds: end, name, audioOnly });
      toast.success("Clip created", { description: clip.outputPath });
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not create clip", { description: error instanceof Error ? error.message : "FFmpeg failed." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Scissors className="h-5 w-5 text-primary" /> Make a clip</DialogTitle>
          <DialogDescription>Create a new file beside the original. The original video is never changed.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {chapters.length > 0 && <div className="space-y-2"><Label>Choose a chapter</Label><div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">{chapters.map((chapter, index) => <Button key={`${chapter.title}-${chapter.startTime}`} type="button" variant="outline" size="sm" onClick={() => { setStart(chapter.startTime); setEnd(chapter.endTime ?? (chapters[index + 1]?.startTime ?? duration)); setName(`${entry.title} - ${chapter.title}`); }}>{chapter.title}</Button>)}</div></div>}

          <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Drag the handles to choose the part you want.</span><span>{formatTime(start)} – {formatTime(end)}</span></div>
            <div
              className="relative h-14 overflow-hidden rounded-md bg-gradient-to-r from-muted via-primary/20 to-muted bg-cover bg-center"
              style={entry.thumbnailSheet ? { backgroundImage: `url(${entry.thumbnailSheet})` } : undefined}
            >
              <div className="absolute inset-0 bg-background/50" />
              <div className="absolute inset-y-1 rounded border border-primary/40 bg-primary/25" style={{ left: `${(start / duration) * 100}%`, right: `${100 - (end / duration) * 100}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="clip-start" className="text-xs">Start</Label><Input id="clip-start" type="range" min={0} max={Math.max(1, duration - 1)} value={start} onChange={(event) => { const value = Number(event.target.value); setStart(value); if (value >= end) setEnd(Math.min(duration, value + 1)); }} /></div><div><Label htmlFor="clip-end" className="text-xs">End</Label><Input id="clip-end" type="range" min={1} max={Math.max(1, duration)} value={end} onChange={(event) => { const value = Number(event.target.value); setEnd(value); if (value <= start) setStart(Math.max(0, value - 1)); }} /></div></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div><Label htmlFor="clip-name">Clip name</Label><Input id="clip-name" className="mt-1" value={name} onChange={(event) => setName(event.target.value)} /></div><div><Label className="mb-1 block">Export</Label><div className="flex rounded-md border border-input p-1"><Button type="button" size="sm" variant={audioOnly ? "ghost" : "secondary"} onClick={() => setAudioOnly(false)}><Video className="mr-1.5 h-3.5 w-3.5" />Video</Button><Button type="button" size="sm" variant={audioOnly ? "secondary" : "ghost"} onClick={() => setAudioOnly(true)}><Music2 className="mr-1.5 h-3.5 w-3.5" />Audio</Button></div></div></div>
          {!validRange && <p className="text-xs text-destructive">Choose an end time after the start time.</p>}
        </div>

        <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={exporting}>Cancel</Button><Button type="button" onClick={() => void handleExport()} disabled={!validRange || exporting || !name.trim()}>{exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scissors className="mr-2 h-4 w-4" />}{exporting ? "Creating clip…" : "Create clip"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
