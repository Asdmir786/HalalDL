import { 
  Settings as SettingsIcon, 
  RotateCcw,
  Save,
  Loader2
} from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SettingsHeaderProps {
  isGlobalDirty: boolean;
  isDirty: boolean;
  isResetting?: boolean;
  onGlobalReset: () => void;
  onResetAll: () => void;
  onResetGroup: (group: "appearance" | "storage" | "behavior" | "downloadEngine") => void;
  onSave: () => void;
}

export function SettingsHeader({
  isGlobalDirty,
  isDirty,
  isResetting = false,
  onGlobalReset,
  onResetAll,
  onResetGroup,
  onSave
}: SettingsHeaderProps) {
  return (
    <FadeInItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Settings
        </h2>
        <p className="text-muted-foreground">Configure HalalDL behavior and appearance.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <MotionButton
          variant="outline"
          size="sm"
          disabled={!isGlobalDirty || isResetting}
          onClick={onGlobalReset}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isResetting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          Restore Defaults
        </MotionButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!isDirty}>
            <MotionButton 
              variant="outline" 
              size="sm"
              disabled={!isDirty}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </MotionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onResetAll}>Reset all</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onResetGroup("appearance")}>Reset appearance</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetGroup("storage")}>Reset storage</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetGroup("behavior")}>Reset behavior</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onResetGroup("downloadEngine")}>Reset download engine</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <MotionButton 
          onClick={onSave}
          size="sm"
          disabled={!isDirty}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </MotionButton>
      </div>
    </FadeInItem>
  );
}
