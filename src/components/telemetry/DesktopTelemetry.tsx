import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { reportDesktopOpen } from "@/lib/desktop-telemetry";
import { storage } from "@/lib/storage";
import { getAppMode } from "@/lib/tools/app-mode";
import { useSettingsStore } from "@/store/settings";

export function DesktopTelemetry() {
  const { settings, updateSettings } = useSettingsStore();
  const [choice, setChoice] = useState(settings.anonymousUsageEnabled);
  const showPrompt = !settings.anonymousUsagePrompted;

  useEffect(() => {
    if (!settings.anonymousUsagePrompted || !settings.anonymousUsageEnabled) return;
    void getVersion()
      .then((version) => reportDesktopOpen({ version, channel: getAppMode() }))
      .catch(() => void 0);
  }, [settings.anonymousUsageEnabled, settings.anonymousUsagePrompted]);

  const saveChoice = () => {
    const next = {
      ...useSettingsStore.getState().settings,
      anonymousUsageEnabled: choice,
      anonymousUsagePrompted: true,
    };
    updateSettings(next);
    void storage.saveSettings(next).catch(() => void 0);
  };

  return (
    <Dialog open={showPrompt} onOpenChange={() => void 0}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Anonymous usage</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Wallahi bro, your IP and private or critical stuff are never stored or tied to you. Only an anonymous HalalDL-use count reaches the server, so the total number of app users can be understood.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Share anonymous usage</p>
            <p className="mt-1 text-xs text-muted-foreground">Can be changed any time in Settings → Behavior.</p>
          </div>
          <Switch checked={choice} onCheckedChange={setChoice} aria-label="Share anonymous usage" />
        </div>
        <DialogFooter><Button type="button" onClick={saveChoice}>Next</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
