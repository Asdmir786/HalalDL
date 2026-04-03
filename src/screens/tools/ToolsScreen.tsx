import { useToolsStore } from "@/store/tools";
import { useAttentionStore } from "@/store/attention";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import {
  Wrench,
  Loader2,
  RefreshCcw,
  Download,
  Trash2,
  Info,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { ToolRow } from "./components/ToolRow";
import { ToolsProgressModal } from "./components/ToolsProgressModal";
import { useDownloadProgressModal } from "./hooks/useDownloadProgressModal";
import { useToolActions } from "./hooks/useToolActions";

export function ToolsScreen() {
  const { tools } = useToolsStore();
  const appMode = String(import.meta.env.VITE_APP_MODE ?? "").trim().toUpperCase();
  const isLite = appMode !== "FULL";

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const attentionTarget = useAttentionStore((state) => state.target);
  const clearAttentionTarget = useAttentionStore((state) => state.clearTarget);
  const [spotlightToolId, setSpotlightToolId] = useState<string | null>(null);
  const [spotlightToken, setSpotlightToken] = useState<number | null>(null);
  const [spotlightReason, setSpotlightReason] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  const modal = useDownloadProgressModal(tools);
  const actions = useToolActions(modal.modalApi);

  useEffect(() => {
    if (!attentionTarget || attentionTarget.screen !== "tools") return;

    const nextToken = attentionTarget.token;
    const nextToolId =
      attentionTarget.targetType === "tool" ? attentionTarget.targetId ?? null : null;

    setSpotlightToken(nextToken);
    setSpotlightToolId(nextToolId);
    setSpotlightReason(attentionTarget.reason);

    const scrollTarget = () => {
      const container = scrollRef.current;
      if (!container) return;
      if (nextToolId) {
        const row = container.querySelector<HTMLElement>(`[data-tool-id="${nextToolId}"]`);
        row?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      container.scrollTo({ top: 0, behavior: "smooth" });
    };

    const raf = window.requestAnimationFrame(scrollTarget);
    clearAttentionTarget(nextToken);

    const timeout = window.setTimeout(() => {
      setSpotlightToken((current) => (current === nextToken ? null : current));
      setSpotlightToolId((current) => (current === nextToolId ? null : current));
      setSpotlightReason((current) => (current === attentionTarget.reason ? null : current));
    }, 4200);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [attentionTarget, clearAttentionTarget]);

  return (
    <div
      className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full"
      role="main"
    >
      <FadeInStagger className="flex flex-col h-full">
        {/* Header */}
        <FadeInItem>
          <header className="p-8 pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Wrench className="w-8 h-8 text-primary" />
                  Tools
                </h2>
                <p className="text-muted-foreground text-sm">
                  External binaries for downloading and processing media.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {actions.hasAnyBackup && (
                  <MotionButton
                    variant="outline"
                    size="sm"
                    onClick={actions.handleCleanupAll}
                    disabled={actions.anyBusy}
                    className="h-9"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clean up backups
                  </MotionButton>
                )}
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={actions.checkAll}
                  disabled={actions.isCheckingAll || actions.anyBusy}
                  className="h-9"
                >
                  {actions.isCheckingAll ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-4 h-4 mr-2" />
                  )}
                  Check All
                </MotionButton>
                {actions.actionableCount > 0 && (
                  <MotionButton
                    size="sm"
                    onClick={actions.updateAll}
                    disabled={actions.anyBusy || modal.isTransferActive}
                    className="h-9"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Update All
                  </MotionButton>
                )}
              </div>
            </div>
          </header>
        </FadeInItem>

        {/* Tool list */}
        <FadeInItem className="flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-auto px-8 pb-8"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-white/6 bg-background/40 backdrop-blur-sm overflow-hidden shadow-sm">
                {tools.map((tool, i) => (
                  <ToolRow
                    key={tool.id}
                    tool={tool}
                    isLast={i === tools.length - 1}
                    isBusy={!!actions.busyTools[tool.id]}
                    isTransferActive={modal.isTransferActive}
                    spotlighted={spotlightToken !== null && spotlightToolId === tool.id}
                    spotlightReason={spotlightReason}
                    onRefresh={actions.refreshTool}
                    onInstallOrUpdate={actions.installOrUpdate}
                    onPipUpgrade={actions.handlePipUpgrade}
                    onUpdateOriginal={actions.handleUpdateOriginal}
                    onChannelChange={actions.handleChannelChange}
                    onManualPath={actions.handleManualPath}
                    onResetToAuto={actions.resetToAuto}
                    onRollback={actions.handleRollback}
                    onCleanupBackup={actions.handleCleanupBackup}
                  />
                ))}
              </div>

              {isLite && (
                <div className="rounded-xl border border-muted/40 bg-muted/10 p-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Lite Mode</strong>{" "}
                    &mdash; Tools are downloaded to your AppData bin folder. Use the
                    overflow menu to set custom paths or visit tool websites.
                  </span>
                </div>
              )}
            </div>
          </div>
        </FadeInItem>
      </FadeInStagger>

      {/* Download Progress Modal */}
      <ToolsProgressModal
        open={modal.modalOpen}
        onOpenChange={modal.setModalOpen}
        isDownloading={modal.isDownloading}
        modalTitle={modal.modalTitle}
        modalDone={modal.modalDone}
        modalError={modal.modalError}
        modalBatchResult={modal.modalBatchResult}
        modalCurrentToolName={modal.modalCurrentToolName}
        modalCurrentStatus={modal.modalCurrentStatus}
        modalProgress={modal.modalProgress}
        modalToolProgress={modal.modalToolProgress}
        orderedModalToolIds={modal.orderedModalToolIds}
        toolNameById={modal.toolNameById}
        modalLogs={modal.modalLogs}
        onDismiss={modal.handleDismiss}
      />
    </div>
  );
}
