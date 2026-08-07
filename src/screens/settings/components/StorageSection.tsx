import { Archive, FileJson, HardDrive, FolderOpen, FolderCog, Images, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MotionButton } from "@/components/motion/MotionButton";
import { open } from "@tauri-apps/plugin-dialog";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";

interface StorageSectionProps {
  defaultDownloadDir: string;
  onDirectoryChange: (dir: string) => void;
  tempDir: string;
  onTempDirChange: (dir: string) => void;
  skipDownloadedBefore: boolean;
  onSkipDownloadedBeforeChange: (value: boolean) => void;
  saveMetadataFiles: boolean;
  onSaveMetadataFilesChange: (value: boolean) => void;
  generateThumbnailContactSheets: boolean;
  onGenerateThumbnailContactSheetsChange: (value: boolean) => void;
}

export function StorageSection({
  defaultDownloadDir,
  onDirectoryChange,
  tempDir,
  onTempDirChange,
  skipDownloadedBefore,
  onSkipDownloadedBeforeChange,
  saveMetadataFiles,
  onSaveMetadataFilesChange,
  generateThumbnailContactSheets,
  onGenerateThumbnailContactSheetsChange,
}: StorageSectionProps) {
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

      <SettingRow
        icon={Archive}
        label="Avoid downloading the same video twice"
        description="Remember finished links so HalalDL can skip a video you already downloaded. Usually leave this on."
      >
        <Switch checked={skipDownloadedBefore} onCheckedChange={onSkipDownloadedBeforeChange} />
      </SettingRow>

      <SettingRow
        icon={FileJson}
        label="Save video details"
        description="Keep the title, description, thumbnail, and other details beside your download when available."
      >
        <Switch checked={saveMetadataFiles} onCheckedChange={onSaveMetadataFilesChange} />
      </SettingRow>

      <SettingRow
        icon={Images}
        label="Create video preview sheets"
        description="Make a small 3×3 image preview for videos when FFmpeg is available."
      >
        <Switch checked={generateThumbnailContactSheets} onCheckedChange={onGenerateThumbnailContactSheetsChange} />
      </SettingRow>
    </SettingsSection>
  );
}
