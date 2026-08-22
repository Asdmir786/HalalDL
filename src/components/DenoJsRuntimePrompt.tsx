import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { Badge } from "@/components/ui/badge";
import { Cpu, Wrench } from "lucide-react";
import { useDenoJsRuntimeStore, type DenoRuntimeCandidate } from "@/store/deno-js-runtime";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import {
  closeLiteDenoJsRuntimePrompt,
  confirmLiteDenoJsRuntime,
  dismissLiteDenoPickerForSession,
  skipLiteDenoJsRuntimePrompt,
} from "@/lib/downloader/js-runtime";
import { checkDenoVersion } from "@/lib/commands";
import { activateAttentionTarget } from "@/lib/attention";
import { cn } from "@/lib/utils";
import { getAppMode } from "@/lib/tools/app-mode";
import { getDenoCardPreview, isDemoModeEnabled } from "@/lib/demo-mode";

const PREVIEW_CANDIDATES: DenoRuntimeCandidate[] = [
  {
    path: "C:\\Users\\Demo\\AppData\\Local\\deno\\deno.exe",
    version: "2.5.0",
  },
  {
    path: "C:\\Users\\Demo\\scoop\\apps\\deno\\current\\deno.exe",
    version: "2.4.3",
  },
];

function denoSourceLabel(path: string): string {
  const normalized = path.replace(/\//g, "\\").toLowerCase();
  if (normalized.includes("\\scoop\\")) return "Scoop";
  if (normalized.includes("\\chocolatey\\") || normalized.includes("\\choco\\")) return "Chocolatey";
  if (normalized.includes("\\windowsapps\\")) return "winget";
  if (normalized.includes("\\appdata\\local\\deno")) return "Deno installer";
  if (
    normalized.includes("\\appdata\\roaming\\halaldl\\bin") ||
    normalized.includes("\\appdata\\local\\halaldl\\bin")
  ) {
    return "HalalDL tools";
  }
  if (normalized.includes("\\portable-data\\bin")) return "Portable tools";
  if (normalized.includes("\\program files")) return "Program Files";
  if (normalized.includes("\\cargo\\bin")) return "Cargo";
  if (normalized.includes("\\nodejs\\") || normalized.includes("\\npm\\")) return "npm";
  return "On PATH";
}

function versionParts(version?: string): number[] {
  const match = (version ?? "").match(/\d+(?:\.\d+)*/);
  return (match?.[0] ?? "0").split(".").map((part) => Number(part) || 0);
}

function isNewerVersion(a?: string, b?: string): boolean {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const da = left[i] ?? 0;
    const db = right[i] ?? 0;
    if (da !== db) return da > db;
  }
  return false;
}

function uniqueNewestPath(candidates: DenoRuntimeCandidate[]): string | null {
  const versioned = candidates.filter((candidate) => candidate.version);
  if (versioned.length === 0) return null;
  const newest = versioned.reduce((best, candidate) =>
    isNewerVersion(candidate.version, best.version) ? candidate : best
  );
  const ties = versioned.filter(
    (candidate) =>
      !isNewerVersion(candidate.version, newest.version) &&
      !isNewerVersion(newest.version, candidate.version)
  );
  return ties.length === 1 ? ties[0].path : null;
}

export function DenoJsRuntimePrompt() {
  const promptKind = useDenoJsRuntimeStore((state) => state.promptKind);
  const candidates = useDenoJsRuntimeStore((state) => state.candidates);
  const preview = getDenoCardPreview();
  const [selectedPath, setSelectedPath] = useState(
    () => (getDenoCardPreview() === "picker" ? PREVIEW_CANDIDATES[0].path : "")
  );

  const visibleKind = promptKind ?? (preview === "picker" ? "picker" : preview === "missing" ? "missing" : null);
  const visibleCandidates = candidates.length > 0 ? candidates : preview === "picker" ? PREVIEW_CANDIDATES : [];
  const recommendedPath = uniqueNewestPath(visibleCandidates);
  const selected = visibleCandidates.find((candidate) => candidate.path === selectedPath);

  const open =
    visibleKind !== null &&
    (getAppMode() === "LITE" || preview !== null) &&
    (!isDemoModeEnabled() || preview !== null);

  useEffect(() => {
    if (preview === "picker") {
      useDenoJsRuntimeStore.getState().openPicker(PREVIEW_CANDIDATES);
    } else if (preview === "missing") {
      useDenoJsRuntimeStore.getState().openMissing();
    }
  }, [preview]);

  useEffect(() => {
    if (visibleKind !== "picker" || visibleCandidates.length === 0) return;
    setSelectedPath((current) => {
      if (visibleCandidates.some((item) => item.path === current)) return current;
      return recommendedPath ?? visibleCandidates[0].path;
    });
  }, [recommendedPath, visibleCandidates, visibleKind]);

  const refreshDenoTool = useCallback(async () => {
    const result = await checkDenoVersion().catch(() => null);
    useToolsStore.getState().updateTool("deno", {
      status: result ? "Detected" : "Missing",
      version: result?.version,
      variant: result?.variant,
      systemPath: result?.systemPath,
      usingFallback: result?.usingFallback ?? false,
    });
  }, []);

  const handleConfirmPicker = async () => {
    if (!selectedPath) return;
    await confirmLiteDenoJsRuntime(selectedPath);
    useLogsStore.getState().addLog({
      level: "info",
      message: `Using Deno JS runtime: ${selectedPath}`,
    });
    await refreshDenoTool();
  };

  const handleSkip = () => {
    skipLiteDenoJsRuntimePrompt();
  };

  const handleDismissPicker = () => {
    dismissLiteDenoPickerForSession();
  };

  const handleOpenTools = () => {
    closeLiteDenoJsRuntimePrompt();
    void activateAttentionTarget({
      screen: "tools",
      reason: "deno-js-runtime",
      targetType: "tool",
      targetId: "deno",
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) return;
    if (visibleKind === "picker") {
      handleDismissPicker();
      return;
    }
    handleSkip();
  };

  const handlePickerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const index = visibleCandidates.findIndex((candidate) => candidate.path === selectedPath);
    const nextIndex =
      event.key === "ArrowDown"
        ? Math.min(visibleCandidates.length - 1, Math.max(0, index) + 1)
        : Math.max(0, (index < 0 ? 0 : index) - 1);
    setSelectedPath(visibleCandidates[nextIndex]?.path ?? selectedPath);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100%-1rem)] max-w-[560px] border-none bg-transparent p-0 shadow-2xl overflow-hidden outline-none focus:outline-none focus-visible:outline-none"
      >
        <div className="relative flex max-h-[min(760px,calc(100vh-1rem))] min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-background/90 backdrop-blur-2xl">
          <div className="absolute left-0 right-0 top-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary animate-gradient-x" />

          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-3 sm:p-6">
            <DialogHeader className="mb-4">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />
                  <div className="relative rounded-xl border border-primary/20 bg-primary/10 p-2.5">
                    <Cpu className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    {visibleKind === "picker" ? "Choose which Deno" : "Deno not found"}
                  </DialogTitle>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {visibleKind === "picker"
                      ? `${visibleCandidates.length} Deno ${visibleCandidates.length === 1 ? "install" : "installs"} found. Pick the one yt-dlp should use for YouTube JS challenges.`
                      : "YouTube quality may be limited without Deno. Install it from Tools, or skip and add it later."}
                  </p>
                </div>
              </div>
            </DialogHeader>

            {visibleKind === "picker" ? (
              <div
                className="space-y-2"
                role="radiogroup"
                aria-label="Deno installations"
                onKeyDown={handlePickerKeyDown}
              >
                {visibleCandidates.map((candidate) => {
                  const isSelected = candidate.path === selectedPath;
                  const isRecommended = candidate.path === recommendedPath;
                  return (
                    <button
                      key={candidate.path}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setSelectedPath(candidate.path)}
                      className={cn(
                        "w-full rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isSelected
                          ? "border-primary/40 bg-primary/10 shadow-[0_8px_24px_-16px_hsl(var(--primary)/0.9)]"
                          : "border-white/8 bg-muted/15 hover:border-white/14 hover:bg-muted/25"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            isSelected ? "border-primary bg-primary/15" : "border-muted-foreground/35"
                          )}
                          aria-hidden
                        >
                          {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold">
                              {candidate.version ? `Deno ${candidate.version}` : "Deno"}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {denoSourceLabel(candidate.path)}
                            </span>
                            {isRecommended && (
                              <Badge
                                variant="outline"
                                className="h-4 border-primary/30 bg-primary/10 px-1.5 text-[9px] font-semibold text-primary"
                              >
                                Recommended
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                            {candidate.path}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 bg-muted/5 p-4 pt-2 sm:flex-row sm:p-6 sm:pt-2">
            {visibleKind === "picker" ? (
              <>
                <MotionButton
                  type="button"
                  variant="ghost"
                  onClick={handleDismissPicker}
                  className="h-11 w-full flex-1 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  Not now
                </MotionButton>
                <MotionButton
                  type="button"
                  onClick={() => void handleConfirmPicker()}
                  disabled={!selectedPath}
                  className="h-11 w-full flex-1 gap-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  {selected?.version ? `Use Deno ${selected.version}` : "Use this Deno"}
                </MotionButton>
              </>
            ) : (
              <>
                <MotionButton
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  className="h-11 w-full flex-1 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  Not now
                </MotionButton>
                <MotionButton
                  type="button"
                  onClick={handleOpenTools}
                  className="h-11 w-full flex-1 gap-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  <Wrench className="h-4 w-4" />
                  Open Tools
                </MotionButton>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
