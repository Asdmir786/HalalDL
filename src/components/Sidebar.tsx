import { useNavigationStore, type Screen } from "@/store/navigation";
import { 
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HardDriveDownload, 
  Settings, 
  ListMusic, 
  Wrench, 
  Terminal,
  ChevronLeft,
  ChevronRight,
  ArrowDownToLine,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MotionButton } from "@/components/motion/MotionButton";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useMemo, useState } from "react";
import { useDownloadsStore } from "@/store/downloads";
import { Progress } from "@/components/ui/progress";

const NAV_ITEMS: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "downloads", label: "Downloads", icon: HardDriveDownload },
  { id: "presets", label: "Presets", icon: ListMusic },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "settings", label: "Settings", icon: Settings },
];

import { motion } from "framer-motion";

export function Sidebar() {
  const { currentScreen, setScreen, sidebarCollapsed, toggleSidebar } = useNavigationStore();
  const jobs = useDownloadsStore((s) => s.jobs);
  const [version, setVersion] = useState("...");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("0.3.0"));
  }, []);

  const activeCount = useMemo(
    () =>
      jobs.filter(
        (job) => job.status === "Downloading" || job.status === "Post-processing"
      ).length,
    [jobs]
  );

  const queuedCount = useMemo(
    () => jobs.filter((job) => job.status === "Queued").length,
    [jobs]
  );

  const failedCount = useMemo(
    () => jobs.filter((job) => job.status === "Failed").length,
    [jobs]
  );

  const doneCount = useMemo(
    () => jobs.filter((job) => job.status === "Done").length,
    [jobs]
  );

  const overallProgress = useMemo(() => {
    const active = jobs.filter(
      (job) => job.status === "Downloading" || job.status === "Post-processing"
    );
    if (!active.length) return 0;
    const sum = active.reduce((acc, j) => acc + (Number.isFinite(j.progress) ? j.progress : 0), 0);
    return Math.max(0, Math.min(100, Math.round(sum / active.length)));
  }, [jobs]);

  const queueStatus = useMemo(() => {
    const total = activeCount + queuedCount;
    return `${String(activeCount).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
  }, [activeCount, queuedCount]);

  const downloadNavMeta = useMemo(() => {
    if (activeCount > 0) {
      return {
        Icon: ArrowDownToLine,
        count: activeCount,
        badgeClassName: "border border-white/20 bg-white/10 text-foreground/90 backdrop-blur-xl shadow-sm",
        iconClassName: "text-foreground/95",
      };
    }
    if (queuedCount > 0) {
      return {
        Icon: Clock3,
        count: queuedCount,
        badgeClassName: "border border-white/15 bg-white/5 text-foreground/80 backdrop-blur-xl",
        iconClassName: "text-foreground/85",
      };
    }
    if (failedCount > 0) {
      return {
        Icon: AlertTriangle,
        count: failedCount,
        badgeClassName: "border border-white/10 bg-background/70 text-foreground/75 backdrop-blur-xl",
        iconClassName: "text-foreground/80",
      };
    }
    if (doneCount > 0) {
      return {
        Icon: CheckCircle2,
        count: 0,
        badgeClassName: "",
        iconClassName: "text-foreground/75",
      };
    }
    return {
      Icon: HardDriveDownload,
      count: 0,
      badgeClassName: "",
      iconClassName: "text-muted-foreground",
    };
  }, [activeCount, queuedCount, failedCount, doneCount]);

  const showGlobalProgress = activeCount > 0 && currentScreen !== "downloads";
  const DownloadProgressIcon = downloadNavMeta.Icon;

  return (
    <aside className={cn(
      "border-r border-white/10 glass flex flex-col h-full transition-all duration-300 ease-in-out relative",
      sidebarCollapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "p-6 border-b flex items-center justify-between overflow-hidden h-[73px]",
        sidebarCollapsed ? "px-4" : "px-6"
      )}>
        {!sidebarCollapsed && (
          <h1 className="text-xl font-bold tracking-tight truncate">HalalDL</h1>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
             <span className="text-xs font-bold text-primary">H</span>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 mt-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          const isDownloadsItem = item.id === "downloads";
          const NavIcon = isDownloadsItem ? downloadNavMeta.Icon : Icon;
          return (
            <MotionButton
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setScreen(item.id)}
              className={cn(
                "w-full h-10 rounded-lg transition-all duration-200 cursor-pointer group relative overflow-hidden",
                sidebarCollapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
                isActive 
                  ? "text-foreground font-semibold" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary/10 rounded-lg"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <span className="relative z-10 inline-flex h-5 w-5 items-center justify-center overflow-visible">
                <NavIcon className={cn(
                  "w-5 h-5 shrink-0",
                  isDownloadsItem && downloadNavMeta.iconClassName,
                  !isActive && "group-hover:scale-110 transition-transform duration-200"
                )} />
                {isDownloadsItem && sidebarCollapsed && downloadNavMeta.count > 0 && (
                  <span className={cn(
                    "absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-[10px] text-[10px] font-bold flex items-center justify-center ring-1 ring-background/80",
                    downloadNavMeta.badgeClassName
                  )}>
                    {downloadNavMeta.count}
                  </span>
                )}
              </span>
              
              {!sidebarCollapsed && (
                <span className="truncate z-10 relative inline-flex items-center gap-2">
                  <span className="truncate">{item.label}</span>
                  {isDownloadsItem && downloadNavMeta.count > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-[10px] px-1.5 text-[10px] font-semibold",
                        downloadNavMeta.badgeClassName
                      )}
                    >
                      {downloadNavMeta.count}
                    </span>
                  )}
                </span>
              )}
            </MotionButton>
          );
        })}
      </nav>

      {showGlobalProgress && (
        <div className={cn("px-3 pb-3", sidebarCollapsed && "px-2")}>
          <div className={cn("rounded-xl border border-white/10 bg-muted/10 glass-card", sidebarCollapsed ? "p-2" : "p-3")}>
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
                  <DownloadProgressIcon className="w-3.5 h-3.5 text-foreground/80" />
                  Downloading
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{queueStatus}</span>
              </div>
            )}
            <Progress value={overallProgress} className={cn("h-2 bg-secondary/70", sidebarCollapsed && "h-1.5")} />
            {sidebarCollapsed && (
              <div className="mt-1 text-[9px] font-mono text-muted-foreground text-center">
                {queueStatus}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-3 border-t">
        <MotionButton
          type="button"
          variant="ghost"
          size="icon"
          className="w-full flex items-center justify-center hover:bg-accent h-10"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : (
            <div className="flex items-center gap-2 w-full px-1">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs font-medium">Collapse Sidebar</span>
            </div>
          )}
        </MotionButton>
      </div>

      {!sidebarCollapsed && (
        <div className="p-4 text-[10px] text-muted-foreground/60 text-center font-mono tracking-widest uppercase">
          v{version} Lite
        </div>
      )}
    </aside>
  );
}
