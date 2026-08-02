import { Scissors } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SPONSORBLOCK_CATEGORY_OPTIONS,
  type SponsorBlockCategoryId,
} from "@/lib/sponsorblock";
import type { SponsorBlockMode } from "@/store/settings";

interface SponsorBlockControlsProps {
  mode: SponsorBlockMode;
  onModeChange: (mode: SponsorBlockMode) => void;
  categories: SponsorBlockCategoryId[];
  onCategoriesChange: (categories: SponsorBlockCategoryId[]) => void;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  className?: string;
}

export function SponsorBlockControls({
  mode,
  onModeChange,
  categories,
  onCategoriesChange,
  disabled = false,
  disabledReason,
  compact = false,
  className,
}: SponsorBlockControlsProps) {
  const categoriesEnabled = !disabled && mode !== "off";

  const toggleCategory = (id: SponsorBlockCategoryId, checked: boolean) => {
    if (checked) {
      if (categories.includes(id)) return;
      onCategoriesChange([...categories, id]);
      return;
    }

    const next = categories.filter((entry) => entry !== id);
    // Keep at least one category selected while mode is active.
    if (next.length === 0) return;
    onCategoriesChange(next);
  };

  return (
    <div
      className={cn(
        "grid gap-3 rounded-xl border border-muted/40 bg-muted/15 p-3",
        disabled && "opacity-60",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <Scissors className="h-4 w-4 shrink-0 text-primary/80" />
            <label className="text-xs font-medium text-muted-foreground">
              SponsorBlock
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {disabled
              ? disabledReason || "Only available for YouTube downloads."
              : compact
                ? "YouTube only. Uses the SponsorBlock community database via yt-dlp."
                : "YouTube only. Mark segments as chapters, or cut them out of the downloaded file."}
          </p>
        </div>
        <Select
          value={mode}
          onValueChange={(value) => onModeChange(value as SponsorBlockMode)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 w-[160px] shrink-0 bg-background/50 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off</SelectItem>
            <SelectItem value="mark">Mark as chapters</SelectItem>
            <SelectItem value="remove">Remove segments</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode !== "off" && !disabled ? (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted-foreground">
              Categories
            </p>
            <p className="text-[10px] text-muted-foreground">
              {mode === "mark" ? "Become chapters in the file" : "Cut from the file (needs FFmpeg)"}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {SPONSORBLOCK_CATEGORY_OPTIONS.map((option) => {
              const checked = categories.includes(option.id);
              const checkboxId = `sponsorblock-${option.id}`;
              return (
                <label
                  key={option.id}
                  htmlFor={checkboxId}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors",
                    categoriesEnabled ? "hover:bg-background/60" : "cursor-not-allowed",
                    checked && categoriesEnabled && "border-border/50 bg-background/50"
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={checked}
                    disabled={!categoriesEnabled || (checked && categories.length === 1)}
                    onCheckedChange={(value) => toggleCategory(option.id, value === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground/90">
                      {option.label}
                    </span>
                    {!compact ? (
                      <span className="block text-[10px] text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
