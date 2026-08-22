import { useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import { AlertTriangle, ClipboardCheck, Copy, ExternalLink, Loader2, RotateCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyText } from "@/lib/copy-text";
import { buildDoctorPaste, getDoctorFinding, HALALDL_ISSUES_URL } from "@/lib/download-doctor";
import { collectJobLogHints } from "@/lib/downloader/failure-messages";
import { buildCopyDiagnosticsSummary, getSupportOsLabel } from "@/lib/diagnostics";
import { formatDiagnosticsPackageLabel } from "@/lib/diagnostics-summary";
import { probeReliability } from "@/lib/reliability";
import { isTauriRuntime } from "@/lib/tauri-runtime";
import { useAppUpdateStore } from "@/store/app-update";
import { useLogsStore } from "@/store/logs";
import { useNavigationStore } from "@/store/navigation";

type DownloadDoctorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  url: string;
  failure: string;
  jobId?: string;
  onRetry?: () => void;
};

async function openExternal(url: string) {
  if (isTauriRuntime()) {
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

const COPY_TOAST = "Copied. Paste this into a GitHub issue.";

export function DownloadDoctorDialog({
  open: isOpen,
  onOpenChange,
  title,
  url,
  failure,
  jobId,
  onRetry,
}: DownloadDoctorDialogProps) {
  const setScreen = useNavigationStore((state) => state.setScreen);
  const installerType = useAppUpdateStore((state) => state.installContext?.installerType) ?? "unknown";
  const [includeUrl, setIncludeUrl] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("Unknown");
  const failureText = checkResult || failure;
  const finding = useMemo(() => getDoctorFinding(failureText), [failureText]);
  const packageLabel = formatDiagnosticsPackageLabel(installerType);

  useEffect(() => {
    if (!isOpen || !isTauriRuntime()) return;
    void getVersion().then(setAppVersion).catch(() => setAppVersion("Unknown"));
  }, [isOpen]);

  const buildPaste = () => {
    const logHints = jobId ? collectJobLogHints(useLogsStore.getState().logs, jobId) : [];
    const supportInfo = buildCopyDiagnosticsSummary({
      version: appVersion,
      packageLabel,
      osLabel: getSupportOsLabel(),
      includeLastFailedJob: false,
    });
    return buildDoctorPaste({
      title,
      url,
      failure: failureText,
      includeUrl,
      logHints,
      supportInfo,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCheckResult(null);
      setChecking(false);
      setIncludeUrl(false);
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

  const handleCopyDetails = () => copyText(buildPaste(), COPY_TOAST);

  const handleOpenIssue = async () => {
    try {
      await copyText(buildPaste(), COPY_TOAST);
      await openExternal(HALALDL_ISSUES_URL);
    } catch {
      await copyText(buildPaste(), COPY_TOAST);
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
              <div>
                <p className="text-sm font-semibold">{finding.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{finding.summary}</p>
              </div>
            </div>
            {failure ? (
              <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-border/70 pt-3 font-mono text-[11px] leading-relaxed text-foreground">
                {failure}
              </pre>
            ) : null}
            {checkResult ? (
              <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">Latest safe check: {checkResult}</p>
            ) : null}
          </div>

          <Button type="button" variant="outline" className="w-full justify-center" disabled={checking} onClick={() => void handleSafeCheck()}>
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
            {checking ? "Checking link…" : "Check link again"}
          </Button>

          {finding.action && (
            <Button type="button" className="w-full" onClick={handleSuggestedAction}>
              {finding.action === "retry" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Wrench className="mr-2 h-4 w-4" />}
              {finding.actionLabel}
            </Button>
          )}

          <div className="rounded-lg border border-border p-3">
            <p className="text-sm font-semibold">Still not fixed?</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Copy the full details (error, logs, tools, version). The link stays out unless you check the box.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={includeUrl} onCheckedChange={(checked) => setIncludeUrl(checked === true)} />
              <span>Include this link in the copied details</span>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="flex-1" onClick={() => void handleCopyDetails()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy full details
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleOpenIssue()}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open GitHub
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
