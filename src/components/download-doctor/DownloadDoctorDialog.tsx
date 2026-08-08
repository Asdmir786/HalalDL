import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import { AlertTriangle, ClipboardCheck, ExternalLink, Loader2, RotateCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyText } from "@/lib/copy-text";
import { buildDoctorIssueUrl, buildDoctorReport, getDoctorFinding } from "@/lib/download-doctor";
import { getSupportOsLabel } from "@/lib/diagnostics";
import { probeReliability } from "@/lib/reliability";
import { isTauriRuntime } from "@/lib/tauri-runtime";
import { useNavigationStore } from "@/store/navigation";
import { useToolsStore } from "@/store/tools";

type DownloadDoctorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  url: string;
  failure: string;
  onRetry?: () => void;
};

async function openExternal(url: string) {
  if (isTauriRuntime()) {
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function DownloadDoctorDialog({ open: isOpen, onOpenChange, title, url, failure, onRetry }: DownloadDoctorDialogProps) {
  const tools = useToolsStore((state) => state.tools);
  const setScreen = useNavigationStore((state) => state.setScreen);
  const [includeUrl, setIncludeUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("Unknown");
  const finding = useMemo(() => getDoctorFinding(checkResult || failure), [checkResult, failure]);

  useEffect(() => {
    if (!isOpen || !isTauriRuntime()) return;
    void getVersion().then(setAppVersion).catch(() => setAppVersion("Unknown"));
  }, [isOpen]);

  const report = buildDoctorReport({ title, url, failure: checkResult || failure, appVersion, osLabel: getSupportOsLabel(), tools, includeUrl });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCheckResult(null);
      setChecking(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSafeCheck = async () => {
    setChecking(true);
    try {
      const result = await probeReliability(url);
      setCheckResult(result.message);
    } finally {
      setChecking(false);
    }
  };

  const handleSuggestedAction = () => {
    if (finding.action === "retry" && onRetry) {
      onRetry();
      handleOpenChange(false);
      return;
    }
    if (finding.action === "tools") setScreen("tools");
    if (finding.action === "settings") setScreen("settings");
    handleOpenChange(false);
  };

  const handleOpenIssue = async () => {
    try {
      await openExternal(buildDoctorIssueUrl(report, title));
    } catch {
      await copyText(report, "Report copied — paste it into a GitHub issue");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Fix this download</DialogTitle>
          <DialogDescription>HalalDL checks for safe fixes first. It will never send your link or sign-in file without your permission.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div><p className="text-sm font-semibold">{finding.title}</p><p className="mt-1 text-sm text-muted-foreground">{finding.summary}</p></div>
            </div>
            {checkResult && <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">Latest safe check: {checkResult}</p>}
          </div>

          <Button type="button" variant="outline" className="w-full justify-center" disabled={checking} onClick={() => void handleSafeCheck()}>
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
            {checking ? "Checking link…" : "Check link again"}
          </Button>

          {finding.action && <Button type="button" className="w-full" onClick={handleSuggestedAction}>{finding.action === "retry" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Wrench className="mr-2 h-4 w-4" />}{finding.actionLabel}</Button>}

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-semibold">Still not fixed?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Open a GitHub report with a cleaned summary. Links are left out unless you explicitly include this one.</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={includeUrl} onCheckedChange={(checked) => setIncludeUrl(checked === true)} />
              <span>Include this link in the report</span>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void copyText(report, "Report copied")}>Copy report</Button>
              <Button type="button" size="sm" onClick={() => void handleOpenIssue()}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open GitHub report</Button>
            </div>
          </div>
        </div>

        <DialogFooter><Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
