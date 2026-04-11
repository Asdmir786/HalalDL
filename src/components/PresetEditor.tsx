import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRESET_GROUP_LABELS } from "@/lib/preset-display";
import { type Preset, type PresetGroup } from "@/store/presets";
import { splitSubtitleLanguages, subtitleLanguagesToString } from "@/lib/subtitles";

interface PresetEditorProps {
  preset: Preset | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: Partial<Preset>) => void;
}

export function PresetEditor({ preset, isOpen, onClose, onSave }: PresetEditorProps) {
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [args, setArgs] = useState(preset ? preset.args.join(" ") : "");
  const [filenameTemplate, setFilenameTemplate] = useState(preset?.filenameTemplate ?? "");
  const [group, setGroup] = useState<PresetGroup>(preset?.group ?? "custom");
  const [quickEligible, setQuickEligible] = useState(preset?.quickEligible ?? true);
  const [subtitleMode, setSubtitleMode] = useState<"off" | "on" | "only">(
    preset?.subtitleOnly ? "only" : preset?.subtitleMode ?? "off"
  );
  const [subtitleSourcePolicy, setSubtitleSourcePolicy] = useState<
    "manual" | "auto" | "manual-then-auto"
  >(preset?.subtitleSourcePolicy ?? "manual-then-auto");
  const [subtitleLanguageMode, setSubtitleLanguageMode] = useState<
    "all" | "preferred" | "custom"
  >(preset?.subtitleLanguageMode ?? "preferred");
  const [subtitleLanguagesText, setSubtitleLanguagesText] = useState(
    subtitleLanguagesToString(preset?.subtitleLanguages ?? ["en.*", "en"])
  );
  const [subtitleFormat, setSubtitleFormat] = useState<"original" | "srt" | "vtt">(
    preset?.subtitleFormat ?? "srt"
  );

  const handleSave = () => {
    const trimmedFilenameTemplate = filenameTemplate.trim();
    onSave({
      name,
      description,
      args: args.split(" ").filter(a => a.trim() !== ""),
      filenameTemplate: trimmedFilenameTemplate || undefined,
      group,
      quickEligible,
      subtitleMode,
      subtitleSourcePolicy,
      subtitleLanguageMode,
      subtitleLanguages: splitSubtitleLanguages(subtitleLanguagesText),
      subtitleFormat,
      subtitleOnly: subtitleMode === "only",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] glass border border-white/10">
        <DialogHeader>
          <DialogTitle>{preset?.id ? "Edit Preset" : "New Preset"}</DialogTitle>
          <DialogDescription>
            Configure your custom yt-dlp arguments here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="My Custom Preset"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Extract audio as FLAC..."
            />
          </div>
          <div className="grid gap-2">
            <Label>Group</Label>
            <Select value={group} onValueChange={(val) => setGroup(val as PresetGroup)}>
              <SelectTrigger>
                <SelectValue placeholder="Preset group" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESET_GROUP_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="args">Arguments (yt-dlp flags)</Label>
            <Input 
              id="args" 
              value={args} 
              onChange={(e) => setArgs(e.target.value)} 
              placeholder="-f bestvideo+bestaudio --merge-output-format mp4"
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="filename-template">Filename Template</Label>
              <span className="text-[10px] text-muted-foreground">Optional</span>
            </div>
            <div className="flex gap-2">
              <Input
                id="filename-template"
                value={filenameTemplate}
                onChange={(e) => setFilenameTemplate(e.target.value)}
                placeholder="%(title)s [%(id)s].%(ext)s"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Title", value: "%(title)s" },
                { label: "Date", value: "%(upload_date)s" },
                { label: "ID", value: "%(id)s" },
                { label: "Uploader", value: "%(uploader)s" },
              ].map((chip) => (
                <MotionButton
                  key={chip.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg px-2 text-[10px]"
                  onClick={() => setFilenameTemplate((current) => current + chip.value)}
                >
                  {chip.label}
                </MotionButton>
              ))}
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              Used when a download does not set its own filename. Keep <span className="font-mono">%(ext)s</span> if you want full yt-dlp control.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Show in quick download</div>
              <div className="text-xs text-muted-foreground">
                Makes this preset available in tray and quick-download flows.
              </div>
            </div>
            <Switch checked={quickEligible} onCheckedChange={setQuickEligible} />
          </div>
          <div className="grid gap-4 rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="text-sm font-medium">Subtitle defaults</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Mode</Label>
                <Select value={subtitleMode} onValueChange={(val) => setSubtitleMode(val as typeof subtitleMode)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Subtitle mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="on">Video + sidecar subtitles</SelectItem>
                    <SelectItem value="only">Subtitles only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Source</Label>
                <Select
                  value={subtitleSourcePolicy}
                  onValueChange={(val) => setSubtitleSourcePolicy(val as typeof subtitleSourcePolicy)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Subtitle source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual-then-auto">Manual, then auto</SelectItem>
                    <SelectItem value="manual">Manual only</SelectItem>
                    <SelectItem value="auto">Auto only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Language Mode</Label>
                <Select
                  value={subtitleLanguageMode}
                  onValueChange={(val) => setSubtitleLanguageMode(val as typeof subtitleLanguageMode)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Language mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preferred">Preferred languages</SelectItem>
                    <SelectItem value="all">All available</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Format</Label>
                <Select value={subtitleFormat} onValueChange={(val) => setSubtitleFormat(val as typeof subtitleFormat)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Subtitle format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original</SelectItem>
                    <SelectItem value="srt">SRT</SelectItem>
                    <SelectItem value="vtt">VTT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {subtitleLanguageMode === "custom" && (
              <div className="grid gap-2">
                <Label htmlFor="subtitle-languages">Custom Languages</Label>
                <Input
                  id="subtitle-languages"
                  value={subtitleLanguagesText}
                  onChange={(e) => setSubtitleLanguagesText(e.target.value)}
                  placeholder="en.*, en, ur, ar"
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <MotionButton type="button" variant="outline" onClick={onClose}>
            Cancel
          </MotionButton>
          <MotionButton type="button" onClick={handleSave}>
            Save Changes
          </MotionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
