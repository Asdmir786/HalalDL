import { Bell, Clipboard, Trash2, FileWarning, History, Link2, AppWindow, Download, RefreshCw, Languages, MousePointerClick, MousePointer2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCollisionAction, QuickActionBehavior, QuickDestinationMode, DownloadsAddMode, TrayDoubleClickAction, TrayLeftClickAction } from "@/store/settings";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";
import { Input } from "@/components/ui/input";

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
  preferredSubtitleLanguages: string;
  onPreferredSubtitleLanguagesChange: (val: string) => void;
  closeToTray: boolean;
  onCloseToTrayChange: (val: boolean) => void;
  launchAtLogin: boolean;
  onLaunchAtLoginChange: (val: boolean) => void;
  startMinimizedToTray: boolean;
  onStartMinimizedToTrayChange: (val: boolean) => void;
  trayLeftClickAction: TrayLeftClickAction;
  onTrayLeftClickActionChange: (val: TrayLeftClickAction) => void;
  trayDoubleClickAction: TrayDoubleClickAction;
  onTrayDoubleClickActionChange: (val: TrayDoubleClickAction) => void;
  trayMenuShowHideItem: boolean;
  onTrayMenuShowHideItemChange: (val: boolean) => void;
  enableBackgroundUpdateChecks: boolean;
  onEnableBackgroundUpdateChecksChange: (val: boolean) => void;
  checkToolUpdatesInBackground: boolean;
  onCheckToolUpdatesInBackgroundChange: (val: boolean) => void;
  checkAppUpdatesInBackground: boolean;
  onCheckAppUpdatesInBackgroundChange: (val: boolean) => void;
  quickDefaultPreset: string;
  onQuickDefaultPresetChange: (val: string) => void;
  quickActionBehavior: QuickActionBehavior;
  onQuickActionBehaviorChange: (val: QuickActionBehavior) => void;
  quickDownloadStartMode: DownloadsAddMode;
  onQuickDownloadStartModeChange: (val: DownloadsAddMode) => void;
  quickDownloadDestinationMode: QuickDestinationMode;
  onQuickDownloadDestinationModeChange: (val: QuickDestinationMode) => void;
  quickPresetOptions: Array<{ id: string; name: string }>;
}

export function BehaviorSection({
  notifications, onNotificationsChange,
  autoClearFinished, onAutoClearChange,
  autoCopyFile, onAutoCopyChange,
  autoPasteLinks, onAutoPasteLinksChange,
  fileCollision, onFileCollisionChange,
  historyRetention, onHistoryRetentionChange,
  preferredSubtitleLanguages, onPreferredSubtitleLanguagesChange,
  closeToTray, onCloseToTrayChange,
  launchAtLogin, onLaunchAtLoginChange,
  startMinimizedToTray, onStartMinimizedToTrayChange,
  trayLeftClickAction, onTrayLeftClickActionChange,
  trayDoubleClickAction, onTrayDoubleClickActionChange,
  trayMenuShowHideItem, onTrayMenuShowHideItemChange,
  enableBackgroundUpdateChecks, onEnableBackgroundUpdateChecksChange,
  checkToolUpdatesInBackground, onCheckToolUpdatesInBackgroundChange,
  checkAppUpdatesInBackground, onCheckAppUpdatesInBackgroundChange,
  quickDefaultPreset, onQuickDefaultPresetChange,
  quickActionBehavior, onQuickActionBehaviorChange,
  quickDownloadStartMode, onQuickDownloadStartModeChange,
  quickDownloadDestinationMode, onQuickDownloadDestinationModeChange,
  quickPresetOptions,
}: BehaviorSectionProps) {
  const startupOptionsEnabled = launchAtLogin;
  const backgroundChecksEnabled = enableBackgroundUpdateChecks;

  return (
    <SettingsSection id="behavior" icon={Bell} title="Behavior" description="Notifications, clipboard, and file handling preferences.">
      <SettingRow icon={Bell} label="Desktop Notifications" description="Allow HalalDL to show download, app update, and tool update alerts.">
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

      <SettingRow icon={Languages} label="Preferred Subtitle Languages" description="Used by subtitle-enabled presets and quick downloads when language mode is set to preferred.">
        <Input
          value={preferredSubtitleLanguages}
          onChange={(event) => onPreferredSubtitleLanguagesChange(event.target.value)}
          className="w-[220px] font-mono text-xs"
          placeholder="en.*, en"
        />
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

      <SettingRow icon={AppWindow} label="Close To Tray" description="Clicking the window close button keeps HalalDL running in the tray instead of fully quitting.">
        <Switch checked={closeToTray} onCheckedChange={onCloseToTrayChange} />
      </SettingRow>

      <SettingRow icon={AppWindow} label="Launch At Login" description="Start HalalDL automatically when you sign in to Windows. Enable this if you want tray-first startup.">
        <Switch checked={launchAtLogin} onCheckedChange={onLaunchAtLoginChange} />
      </SettingRow>

      <SettingRow
        icon={AppWindow}
        label="Start Minimized To Tray"
        description={
          startupOptionsEnabled
            ? "When HalalDL launches at sign-in, open it hidden in the tray instead of showing the main window."
            : "Requires Launch At Login. Turn that on first if you want HalalDL to start directly in the tray."
        }
        disabled={!startupOptionsEnabled}
        inset
      >
        <Switch
          checked={startMinimizedToTray}
          onCheckedChange={onStartMinimizedToTrayChange}
          disabled={!startupOptionsEnabled}
        />
      </SettingRow>

      <SettingRow icon={MousePointerClick} label="Tray Left Click" description="Choose what happens when you left click the tray icon. Right click always opens the tray menu.">
        <Select value={trayLeftClickAction} onValueChange={(v) => onTrayLeftClickActionChange(v as TrayLeftClickAction)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="quick-panel">Open quick panel</SelectItem>
            <SelectItem value="open-app">Open main app</SelectItem>
            <SelectItem value="none">Do nothing</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={MousePointer2} label="Tray Double Click" description="Optional secondary action for double clicking the tray icon. Keeping this off avoids accidental app opens.">
        <Select value={trayDoubleClickAction} onValueChange={(v) => onTrayDoubleClickActionChange(v as TrayDoubleClickAction)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Do nothing</SelectItem>
            <SelectItem value="open-app">Open main app</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={AppWindow} label="Tray Show/Hide Item" description="Show a dynamic Show HalalDL or Hide HalalDL item in the tray menu.">
        <Switch checked={trayMenuShowHideItem} onCheckedChange={onTrayMenuShowHideItemChange} />
      </SettingRow>

      <SettingRow icon={Download} label="Quick Default Preset" description="Preset used by the quick panel and the Download Copied URL tray action.">
        <Select value={quickDefaultPreset} onValueChange={onQuickDefaultPresetChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Choose preset" />
          </SelectTrigger>
          <SelectContent>
            {quickPresetOptions.map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={Download} label="Copied URL Action" description="Choose whether the tray action opens the quick panel first or immediately downloads the copied URL with the default preset.">
        <Select value={quickActionBehavior} onValueChange={(v) => onQuickActionBehaviorChange(v as QuickActionBehavior)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select behavior" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ask">Ask each time</SelectItem>
            <SelectItem value="instant">Instant download</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={Download} label="Quick Download Start Mode" description="Controls whether quick panel downloads begin right away or sit in the queue waiting for you to start them.">
        <Select value={quickDownloadStartMode} onValueChange={(v) => onQuickDownloadStartModeChange(v as DownloadsAddMode)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select start mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="start">Start immediately</SelectItem>
            <SelectItem value="queue">Queue first</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={Download} label="Quick Destination Mode" description="Choose whether quick downloads save to the default folder or ask you to choose a folder every time.">
        <Select value={quickDownloadDestinationMode} onValueChange={(v) => onQuickDownloadDestinationModeChange(v as QuickDestinationMode)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select destination mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Use default folder</SelectItem>
            <SelectItem value="ask">Ask every time</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow icon={RefreshCw} label="Background Update Checks" description="Let HalalDL quietly check for app and tool updates while it is open or sitting in the tray.">
        <Switch checked={enableBackgroundUpdateChecks} onCheckedChange={onEnableBackgroundUpdateChecksChange} />
      </SettingRow>

      <SettingRow
        icon={RefreshCw}
        label="Tool Update Checks"
        description={
          backgroundChecksEnabled
            ? "Look for newer yt-dlp, FFmpeg, aria2, and Deno versions in the background."
            : "Requires Background Update Checks. Turn that on first to let HalalDL look for tool updates."
        }
        disabled={!backgroundChecksEnabled}
        inset
      >
        <Switch
          checked={checkToolUpdatesInBackground}
          onCheckedChange={onCheckToolUpdatesInBackgroundChange}
          disabled={!backgroundChecksEnabled}
        />
      </SettingRow>

      <SettingRow
        icon={RefreshCw}
        label="App Update Checks"
        description={
          backgroundChecksEnabled
            ? "Look for new HalalDL releases in the background and notify you when one is available."
            : "Requires Background Update Checks. Turn that on first to let HalalDL look for app updates."
        }
        disabled={!backgroundChecksEnabled}
        inset
      >
        <Switch
          checked={checkAppUpdatesInBackground}
          onCheckedChange={onCheckAppUpdatesInBackgroundChange}
          disabled={!backgroundChecksEnabled}
        />
      </SettingRow>
    </SettingsSection>
  );
}
