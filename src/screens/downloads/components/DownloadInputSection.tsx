import { Plus, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadOutputOptions } from "./DownloadOutputOptions";
import { Preset } from "@/store/presets";

interface DownloadInputSectionProps {
  url: string;
  setUrl: (val: string) => void;
  onAdd: () => void;
  selectedPreset: string;
  onPresetChange: (val: string) => void;
  presets: Preset[];
  addMode: "queue" | "start";
  setAddMode: (mode: "queue" | "start") => void;
  
  // Output Config Props
  showOutputConfig: boolean;
  onToggleOutputConfig: () => void;
  filenameBase: string;
  onFilenameChange: (val: string) => void;
  outputFormat: string;
  onFormatChange: (val: string) => void;
  customDownloadDir: string;
  onBrowseDir: () => void;
  isCustomPreset: boolean;
  defaultDownloadDir: string;
}

export function DownloadInputSection({
  url, setUrl, onAdd,
  selectedPreset, onPresetChange, presets,
  addMode, setAddMode,
  showOutputConfig, onToggleOutputConfig,
  filenameBase, onFilenameChange,
  outputFormat, onFormatChange,
  customDownloadDir, onBrowseDir,
  isCustomPreset,
  defaultDownloadDir
}: DownloadInputSectionProps) {
  return (
    <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-xl border border-muted/50 shadow-sm glass-card">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative">
          <Input
            placeholder="Paste video or playlist URL here..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            className="bg-background border-muted shadow-sm focus-visible:ring-1 h-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Select value={selectedPreset} onValueChange={onPresetChange}>
            <SelectTrigger className="w-[140px] bg-background border-muted shadow-sm focus:ring-1 h-10">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom" className="font-semibold text-primary">
                ✨ Custom Configuration
              </SelectItem>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-muted bg-background p-0.5 gap-0.5 h-10 items-center">
            <MotionButton
              type="button"
              variant={addMode === "queue" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md"
              onClick={() => setAddMode("queue")}
            >
              Queue
            </MotionButton>
            <MotionButton
              type="button"
              variant={addMode === "start" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md"
              onClick={() => setAddMode("start")}
            >
              Start now
            </MotionButton>
          </div>

          <MotionButton
            onClick={onAdd}
            disabled={!url.trim()}
            className="shadow-sm h-10 px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </MotionButton>
        </div>
      </div>

      <div className="flex justify-center -mt-1">
        <MotionButton
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 opacity-80 hover:opacity-100 transition-all"
          onClick={onToggleOutputConfig}
        >
          <Settings2 className="w-3 h-3" />
          {showOutputConfig ? "Hide Output Options" : "Show Output Options"}
          {showOutputConfig ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </MotionButton>
      </div>

      {showOutputConfig && (
        <DownloadOutputOptions
          filenameBase={filenameBase}
          onFilenameChange={onFilenameChange}
          outputFormat={outputFormat}
          onFormatChange={onFormatChange}
          customDownloadDir={customDownloadDir}
          onBrowseDir={onBrowseDir}
          isCustomPreset={isCustomPreset}
          defaultDownloadDir={defaultDownloadDir}
        />
      )}
    </div>
  );
}
