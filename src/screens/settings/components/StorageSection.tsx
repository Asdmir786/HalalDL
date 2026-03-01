import { HardDrive, FolderOpen, FolderCog, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MotionButton } from "@/components/motion/MotionButton";
import { open } from "@tauri-apps/plugin-dialog";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";

interface StorageSectionProps {
  defaultDownloadDir: string;
  onDirectoryChange: (dir: string) => void;
  tempDir: string;
  onTempDirChange: (dir: string) => void;
}

export function StorageSection({ defaultDownloadDir, onDirectoryChange, tempDir, onTempDirChange }: StorageSectionProps) {
  return (
    <SettingsSection id="storage" icon={HardDrive} title="Storage" description="Where your downloads and temporary files are saved.">
      <SettingRow icon={FolderOpen} label="Download Directory" description="Where completed downloads are saved by default." vertical>
        <div className="flex gap-2">
          <Input
            value={defaultDownloadDir || ""}
            readOnly
            placeholder="Select a folder..."
            className="bg-muted/30 border-border/30"
          />
          <MotionButton
            variant="outline"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const selected = await open({ directory: true, multiple: false });
              if (selected && !Array.isArray(selected)) onDirectoryChange(selected);
            }}
          >
            <Search className="w-4 h-4 mr-2" />
            Browse
          </MotionButton>
        </div>
      </SettingRow>

      <SettingRow icon={FolderCog} label="Temporary Directory" description="Where in-progress downloads are stored. Leave empty for system default." vertical>
        <div className="flex gap-2">
          <Input
            value={tempDir || ""}
            readOnly
            placeholder="System default"
            className="bg-muted/30 border-border/30"
          />
          <MotionButton
            variant="outline"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              const selected = await open({ directory: true, multiple: false });
              if (selected && !Array.isArray(selected)) onTempDirChange(selected);
            }}
          >
            <Search className="w-4 h-4 mr-2" />
            Browse
          </MotionButton>
        </div>
      </SettingRow>
    </SettingsSection>
  );
}
