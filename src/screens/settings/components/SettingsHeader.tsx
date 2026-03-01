import {
  Settings as SettingsIcon,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";

interface SettingsHeaderProps {
  isGlobalDirty: boolean;
  isResetting?: boolean;
  onGlobalReset: () => void;
}

export function SettingsHeader({
  isGlobalDirty,
  isResetting = false,
  onGlobalReset,
}: SettingsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Settings
        </h2>
        <p className="text-muted-foreground">Configure HalalDL behavior and appearance.</p>
      </div>
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
    </div>
  );
}
