import { Clock3, Play, Plus, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo } from "react";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const GROUP_ORDER = ["Recommended", "Compatibility", "Editors", "Editors Pro", "Web", "Video", "Audio", "Other", "Custom"] as const;

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
  const getGroupAndLabel = (preset: Preset): { group: string; label: string } => {
    const parts = preset.name.split(" — ");
    if (parts.length >= 2) return { group: parts[0], label: parts.slice(1).join(" — ") };
    return { group: preset.isBuiltIn ? "Other" : "Custom", label: preset.name };
  };

  const { grouped, orderedGroups } = useMemo(() => {
    const groupedMap = presets.reduce<Record<string, Array<{ preset: Preset; label: string }>>>((acc, preset) => {
      const { group, label } = getGroupAndLabel(preset);
      acc[group] = acc[group] ?? [];
      acc[group].push({ preset, label });
      return acc;
    }, {});

    const ordered = [
      ...GROUP_ORDER.filter((g) => (groupedMap[g]?.length ?? 0) > 0),
      ...Object.keys(groupedMap).filter((g) => !GROUP_ORDER.includes(g as (typeof GROUP_ORDER)[number])).sort(),
    ];

    return { grouped: groupedMap, orderedGroups: ordered };
  }, [presets]);

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
            <SelectContent className="max-h-[300px] overflow-y-auto" position="popper" sideOffset={6} align="start">
              <SelectItem value="custom" className="font-semibold text-primary">
                ✨ Custom Configuration
              </SelectItem>
              <SelectSeparator />
              {orderedGroups.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/80 py-1.5">
                    {group}
                  </SelectLabel>
                  {(grouped[group] ?? []).map(({ preset, label }) => (
                    <SelectItem key={preset.id} value={preset.id} title={preset.description}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-xl border border-muted bg-background/80 p-0.5 gap-0.5 h-10 items-center shadow-sm">
            <MotionButton
              type="button"
              variant={addMode === "queue" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-lg gap-1.5 data-[state=active]:shadow-sm"
              onClick={() => setAddMode("queue")}
              data-state={addMode === "queue" ? "active" : "inactive"}
            >
              <Clock3 className="w-3 h-3" />
              Queue
            </MotionButton>
            <MotionButton
              type="button"
              variant={addMode === "start" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-lg gap-1.5 data-[state=active]:shadow-sm"
              onClick={() => setAddMode("start")}
              data-state={addMode === "start" ? "active" : "inactive"}
            >
              <Play className="w-3 h-3" />
              Start now
            </MotionButton>
          </div>

          <MotionButton
            onClick={onAdd}
            disabled={!url.trim()}
            className="h-10 px-4 rounded-xl bg-linear-to-r from-primary/95 via-primary to-primary/85 hover:from-primary hover:to-primary shadow-md shadow-primary/20"
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
