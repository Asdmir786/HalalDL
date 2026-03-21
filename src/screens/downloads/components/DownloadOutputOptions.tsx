import { Settings2, FolderOpen, Languages } from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  SubtitleFormat,
  SubtitleLanguageMode,
  SubtitleMode,
  SubtitleSourcePolicy,
} from "@/lib/subtitles";

interface DownloadOutputOptionsProps {
  filenameBase: string;
  onFilenameChange: (val: string) => void;
  outputFormat: string;
  onFormatChange: (val: string) => void;
  customDownloadDir: string;
  onBrowseDir: () => void;
  isCustomPreset: boolean;
  defaultDownloadDir: string;
  subtitleMode: SubtitleMode;
  onSubtitleModeChange: (val: SubtitleMode) => void;
  subtitleSourcePolicy: SubtitleSourcePolicy;
  onSubtitleSourcePolicyChange: (val: SubtitleSourcePolicy) => void;
  subtitleLanguageMode: SubtitleLanguageMode;
  onSubtitleLanguageModeChange: (val: SubtitleLanguageMode) => void;
  subtitleLanguagesText: string;
  onSubtitleLanguagesTextChange: (val: string) => void;
  subtitleFormat: SubtitleFormat;
  onSubtitleFormatChange: (val: SubtitleFormat) => void;
  subtitleHint: string;
}

export function DownloadOutputOptions({
  filenameBase,
  onFilenameChange,
  outputFormat,
  onFormatChange,
  customDownloadDir,
  onBrowseDir,
  isCustomPreset,
  defaultDownloadDir,
  subtitleMode,
  onSubtitleModeChange,
  subtitleSourcePolicy,
  onSubtitleSourcePolicyChange,
  subtitleLanguageMode,
  onSubtitleLanguageModeChange,
  subtitleLanguagesText,
  onSubtitleLanguagesTextChange,
  subtitleFormat,
  onSubtitleFormatChange,
  subtitleHint,
}: DownloadOutputOptionsProps) {
  
  const insertPlaceholder = (placeholder: string) => {
    onFilenameChange(filenameBase + placeholder);
  };

  return (
    <div className="pt-2 border-t border-muted/50 grid gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
       {/* Mode Indicator */}
       {!isCustomPreset && (
          <div className="flex items-center gap-2 bg-blue-500/10 text-blue-500 px-3 py-2 rounded-md text-xs border border-blue-500/20">
            <Settings2 className="w-3.5 h-3.5" />
            <span><strong>Preset Mode Active:</strong> Format settings are managed by the selected preset.</span>
          </div>
       )}

       {/* Row 1: Filename Template */}
       <div className="grid gap-2">
         <div className="flex items-center justify-between">
           <label className="text-xs font-medium text-muted-foreground">Output Filename</label>
           <span className="text-[10px] text-muted-foreground/60">Extension is automatic</span>
         </div>
         <div className="flex gap-2">
           <div className="flex-1 relative flex items-center">
             <Input 
                value={filenameBase}
                onChange={(e) => onFilenameChange(e.target.value)}
                placeholder="%(title)s [%(id)s]"
                className="font-mono text-xs h-9 bg-background/50 rounded-r-none border-r-0"
             />
             <div className="h-9 px-3 flex items-center bg-muted/50 border border-l-0 rounded-r-md text-xs font-mono text-muted-foreground select-none">
               .%(ext)s
             </div>
           </div>
           <div className="flex gap-1">
             {[
               { label: "Title", val: "%(title)s" },
               { label: "Date", val: "%(upload_date)s" },
               { label: "ID", val: "%(id)s" }
             ].map((chip) => (
               <MotionButton
                 key={chip.val}
                 type="button"
                 variant="outline"
                 size="sm"
                 onClick={() => insertPlaceholder(chip.val)}
                 className="h-9 px-2 text-[10px] font-medium bg-muted/50 hover:bg-muted border-muted"
                 title={`Insert ${chip.val}`}
               >
                 {chip.label}
               </MotionButton>
             ))}
           </div>
         </div>
       </div>

       {/* Row 2: Format & Location */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Output Format 
              {!isCustomPreset && <span className="ml-1 opacity-50">(Locked by Preset)</span>}
            </label>
            <Select 
              value={outputFormat} 
              onValueChange={onFormatChange} 
              disabled={!isCustomPreset}
            >
              <SelectTrigger className={cn("h-9 bg-background/50 text-xs", !isCustomPreset && "opacity-70 cursor-not-allowed")}>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Best (Video + Audio)</SelectItem>
                <SelectItem value="mp4">MP4 (Video)</SelectItem>
                <SelectItem value="mkv">MKV (Video)</SelectItem>
                <SelectItem value="webm">WebM (Video)</SelectItem>
                <SelectItem value="mp3">MP3 (Audio Only)</SelectItem>
                <SelectItem value="m4a">M4A (Audio Only)</SelectItem>
                <SelectItem value="flac">FLAC (Audio Only, Lossless)</SelectItem>
                <SelectItem value="wav">WAV (Audio Only, Lossless)</SelectItem>
                <SelectItem value="alac">ALAC (Audio Only, Lossless)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Download Location</label>
              {customDownloadDir ? (
                <span className="text-[10px] text-primary font-medium">Custom</span>
              ) : (
                <span className="text-[10px] text-muted-foreground/60">Using default</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input 
                readOnly
                value={customDownloadDir || defaultDownloadDir || "No default set"}
                className={cn(
                  "h-9 text-xs bg-background/50",
                  !customDownloadDir && !defaultDownloadDir && "text-destructive/80 border-destructive/30"
                )}
              />
              <MotionButton variant="outline" size="sm" onClick={onBrowseDir} className="h-9 px-3">
                <FolderOpen className="w-3.5 h-3.5" />
              </MotionButton>
            </div>
          </div>
       </div>

       <div className="grid gap-3 rounded-xl border border-muted/40 bg-muted/15 p-3">
         <div className="flex items-center justify-between gap-3">
           <div className="flex items-center gap-2">
             <Languages className="h-4 w-4 text-primary/80" />
             <label className="text-xs font-medium text-muted-foreground">Subtitles</label>
           </div>
           <span className="text-[10px] text-muted-foreground">{subtitleHint}</span>
         </div>

         <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
           <div className="grid gap-2">
             <label className="text-xs font-medium text-muted-foreground">Subtitle Mode</label>
             <Select value={subtitleMode} onValueChange={(val) => onSubtitleModeChange(val as SubtitleMode)}>
               <SelectTrigger className="h-9 bg-background/50 text-xs">
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
             <label className="text-xs font-medium text-muted-foreground">Source Preference</label>
             <Select
               value={subtitleSourcePolicy}
               onValueChange={(val) =>
                 onSubtitleSourcePolicyChange(val as SubtitleSourcePolicy)
               }
             >
               <SelectTrigger className="h-9 bg-background/50 text-xs">
                 <SelectValue placeholder="Subtitle source" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="manual-then-auto">Manual, then auto fallback</SelectItem>
                 <SelectItem value="manual">Manual only</SelectItem>
                 <SelectItem value="auto">Auto only</SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="grid gap-2">
             <label className="text-xs font-medium text-muted-foreground">Language Mode</label>
             <Select
               value={subtitleLanguageMode}
               onValueChange={(val) =>
                 onSubtitleLanguageModeChange(val as SubtitleLanguageMode)
               }
             >
               <SelectTrigger className="h-9 bg-background/50 text-xs">
                 <SelectValue placeholder="Subtitle language mode" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="preferred">Preferred languages</SelectItem>
                 <SelectItem value="all">All available languages</SelectItem>
                 <SelectItem value="custom">Custom languages</SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="grid gap-2">
             <label className="text-xs font-medium text-muted-foreground">Subtitle Format</label>
             <Select value={subtitleFormat} onValueChange={(val) => onSubtitleFormatChange(val as SubtitleFormat)}>
               <SelectTrigger className="h-9 bg-background/50 text-xs">
                 <SelectValue placeholder="Subtitle format" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="original">Keep original format</SelectItem>
                 <SelectItem value="srt">Convert to SRT</SelectItem>
                 <SelectItem value="vtt">Convert to VTT</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>

         {subtitleLanguageMode === "custom" && (
           <div className="grid gap-2">
             <label className="text-xs font-medium text-muted-foreground">
               Custom Subtitle Languages
             </label>
             <Input
               value={subtitleLanguagesText}
               onChange={(e) => onSubtitleLanguagesTextChange(e.target.value)}
               placeholder="en.*, en, ur, ar"
               className="h-9 bg-background/50 font-mono text-xs"
             />
           </div>
         )}
       </div>
    </div>
  );
}
