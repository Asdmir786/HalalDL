import { Bell, Clipboard, Trash2, FileWarning, History, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCollisionAction } from "@/store/settings";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";

interface BehaviorSectionProps {
  notifications: boolean;
  onNotificationsChange: (val: boolean) => void;
  autoClearFinished: boolean;
  onAutoClearChange: (val: boolean) => void;
  autoCopyFile: boolean;
  onAutoCopyChange: (val: boolean) => void;
  autoPasteLinks: boolean;
  onAutoPasteLinksChange: (val: boolean) => void;
  fileCollision: FileCollisionAction;
  onFileCollisionChange: (val: FileCollisionAction) => void;
  historyRetention: number;
  onHistoryRetentionChange: (val: number) => void;
}

export function BehaviorSection({
  notifications, onNotificationsChange,
  autoClearFinished, onAutoClearChange,
  autoCopyFile, onAutoCopyChange,
  autoPasteLinks, onAutoPasteLinksChange,
  fileCollision, onFileCollisionChange,
  historyRetention, onHistoryRetentionChange,
}: BehaviorSectionProps) {
  return (
    <SettingsSection id="behavior" icon={Bell} title="Behavior" description="Notifications, clipboard, and file handling preferences.">
      <SettingRow icon={Bell} label="Desktop Notifications" description="Show alerts when downloads complete or fail.">
        <Switch checked={notifications} onCheckedChange={onNotificationsChange} />
      </SettingRow>

      <SettingRow icon={Trash2} label="Auto-Clear Completed" description="Automatically remove finished downloads from the list.">
        <Switch checked={autoClearFinished} onCheckedChange={onAutoClearChange} />
      </SettingRow>

      <SettingRow icon={Clipboard} label="Auto-Copy File" description="Copy downloaded file to clipboard when complete.">
        <Switch checked={autoCopyFile} onCheckedChange={onAutoCopyChange} />
      </SettingRow>

      <SettingRow icon={Link2} label="Auto-Paste Links" description="When the URL box is focused, paste a supported link from clipboard.">
        <Switch checked={autoPasteLinks} onCheckedChange={onAutoPasteLinksChange} />
      </SettingRow>

      <SettingRow icon={FileWarning} label="File Collision" description="What to do when a file with the same name exists.">
        <Select value={fileCollision} onValueChange={(v) => onFileCollisionChange(v as FileCollisionAction)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overwrite">Overwrite</SelectItem>
            <SelectItem value="rename">Rename (Auto-increment)</SelectItem>
            <SelectItem value="skip">Skip</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={History} label="History Retention" description="Max number of history entries to keep (0 = unlimited).">
        <Select value={String(historyRetention)} onValueChange={(v) => onHistoryRetentionChange(Number(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select limit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Unlimited</SelectItem>
            <SelectItem value="100">100 entries</SelectItem>
            <SelectItem value="500">500 entries</SelectItem>
            <SelectItem value="1000">1,000 entries</SelectItem>
            <SelectItem value="5000">5,000 entries</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>
    </SettingsSection>
  );
}
