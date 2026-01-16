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
import { useEffect, useState } from "react";

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
  const [version, setVersion] = useState("...");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("0.3.0"));
  }, []);

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
              
              <Icon className={cn(
                "w-5 h-5 flex-shrink-0 z-10 relative",
                !isActive && "group-hover:scale-110 transition-transform duration-200"
              )} />
              
              {!sidebarCollapsed && (
                <span className="truncate z-10 relative">{item.label}</span>
              )}
            </MotionButton>
          );
        })}
      </nav>

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
