import { useNavigationStore, type Screen } from "@/store/navigation";
import { 
  Download, 
  Settings, 
  ListMusic, 
  Wrench, 
  Terminal,
  ChevronLeft,
  ChevronRight,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MotionButton } from "@/components/motion/MotionButton";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useMemo, useState } from "react";
import { useDownloadsStore } from "@/store/downloads";
import { Progress } from "@/components/ui/progress";

const NAV_ITEMS: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "downloads", label: "Downloads", icon: Download },
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
    const total = jobs.length;
    const processed = doneCount + activeCount;
    return `${String(processed).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
  }, [activeCount, doneCount, jobs.length]);

  const showGlobalProgress = activeCount > 0 && currentScreen !== "downloads";

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

              <span className="relative z-10">
                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0",
                  !isActive && "group-hover:scale-110 transition-transform duration-200"
                )} />
                {item.id === "downloads" && activeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow">
                    {activeCount}
                  </span>
                )}
              </span>
              
              {!sidebarCollapsed && (
                <span className="truncate z-10 relative">{item.label}</span>
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
                <span className="text-xs font-semibold text-foreground/90">Downloading</span>
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
