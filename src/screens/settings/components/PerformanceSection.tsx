import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock3,
  Copy,
  Cpu,
  Database,
  Gauge,
  ListTree,
  Wrench,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { MotionButton } from "@/components/motion/MotionButton";
import {
  buildCopyDiagnosticsSummary,
  getSupportOsLabel,
} from "@/lib/diagnostics";
import { formatDiagnosticsPackageLabel } from "@/lib/diagnostics-summary";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import {
  formatPerformanceReport,
  getLastStartupSummary,
  getMarkMs,
  subscribeStartupSummary,
  type StartupSummary,
} from "@/lib/startup-metrics";
import { useAppUpdateStore } from "@/store/app-update";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";

function formatMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value)}ms`;
}

function TimingValue({ value }: { value: string }) {
  return (
    <span className="font-mono text-sm tabular-nums text-foreground/90">
      {value}
    </span>
  );
}

export function PerformanceSection() {
  const [summary, setSummary] = useState<StartupSummary | null>(() =>
    getLastStartupSummary()
  );
  const [version, setVersion] = useState(() =>
    isDemoModeEnabled() ? "0.4.0" : "..."
  );
  const installerType =
    useAppUpdateStore((state) => state.installContext?.installerType) ??
    "unknown";
  const packageLabel = formatDiagnosticsPackageLabel(installerType);

  useEffect(() => {
    setSummary(getLastStartupSummary());
    return subscribeStartupSummary(() => {
      setSummary(getLastStartupSummary());
    });
  }, []);

  useEffect(() => {
    if (isDemoModeEnabled()) return;
    getVersion()
      .then(setVersion)
      .catch(() => setVersion("unknown"));
  }, []);

  const handleCopySupportInfo = useCallback(async () => {
    try {
      const summaryText = buildCopyDiagnosticsSummary({
        version: version === "..." ? "unknown" : version,
        packageLabel,
        osLabel: getSupportOsLabel(),
      });
      await navigator.clipboard.writeText(summaryText);
      toast.success("Support info copied", {
        description: "Paste it into a GitHub issue if you need help.",
      });
    } catch {
      toast.error("Could not copy support info");
    }
  }, [packageLabel, version]);

  const handleCopyPerformanceReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatPerformanceReport(summary));
      toast.success("Performance report copied", {
        description: "Startup timings are ready to paste.",
      });
    } catch {
      toast.error("Could not copy performance report");
    }
  }, [summary]);

  const firstUsableFrameMs = getMarkMs(summary, "first-usable-frame");
  const persistenceReadyMs = getMarkMs(summary, "persistence-critical-ready");
  const toolsCheckReadyMs = getMarkMs(summary, "tools-check-ready");
  const hasTimings = Boolean(summary && summary.marks.length > 0);

  return (
    <SettingsSection
      id="performance"
      icon={Activity}
      title="Performance"
      description="Startup timings from this session. Copy them into GitHub issues with support info."
    >
      {!hasTimings ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 px-4 py-3.5 text-sm text-muted-foreground">
          Available after this session&apos;s startup completes.
        </div>
      ) : null}

      <SettingRow
        icon={Clock3}
        label="First usable frame"
        description="Time until the main UI became interactive."
      >
        <TimingValue value={formatMs(firstUsableFrameMs)} />
      </SettingRow>

      <SettingRow
        icon={Cpu}
        label="Rust setup"
        description="Native shell setup before the webview was ready."
      >
        <TimingValue value={formatMs(summary?.rustSetupCompleteMs)} />
      </SettingRow>

      <SettingRow
        icon={Database}
        label="Persistence ready"
        description="Critical settings and downloads finished loading."
      >
        <TimingValue value={formatMs(persistenceReadyMs)} />
      </SettingRow>

      <SettingRow
        icon={Wrench}
        label="Tools check ready"
        description="yt-dlp, ffmpeg, aria2, and deno status checks finished."
      >
        <TimingValue value={formatMs(toolsCheckReadyMs)} />
      </SettingRow>

      <SettingRow
        icon={ListTree}
        label="All startup marks"
        description="Full mark timeline for this launch."
        vertical
      >
        {hasTimings ? (
          <div className="max-h-48 overflow-auto rounded-lg border border-border/40 bg-background/40 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
            {summary!.marks.map((mark) => (
              <div key={`${mark.name}-${mark.ms}`} className="flex justify-between gap-4">
                <span>{mark.name}</span>
                <span className="tabular-nums text-foreground/80">{mark.ms}ms</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No marks recorded yet.</p>
        )}
      </SettingRow>

      <SettingRow
        icon={Gauge}
        label="Share timings"
        description="Copy support info (includes Performance) or a performance-only report."
        vertical
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <MotionButton
            variant="outline"
            size="sm"
            onClick={() => void handleCopySupportInfo()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full sm:w-auto"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy support info
          </MotionButton>
          <MotionButton
            variant="outline"
            size="sm"
            onClick={() => void handleCopyPerformanceReport()}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full sm:w-auto"
          >
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            Copy performance report
          </MotionButton>
        </div>
      </SettingRow>
    </SettingsSection>
  );
}
