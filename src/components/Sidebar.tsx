import { useNavigationStore, type Screen } from "@/store/navigation";
import { 
  Download, 
  Settings, 
  ListMusic, 
  Wrench, 
  Terminal,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "presets", label: "Presets", icon: ListMusic },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { currentScreen, setScreen } = useNavigationStore();

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold tracking-tight">HalalDL</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground hover:pl-4",
                isActive ? "bg-accent text-accent-foreground font-medium shadow-sm" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t text-xs text-muted-foreground text-center">
        v0.1.0 Lite
      </div>
    </aside>
  );
}
