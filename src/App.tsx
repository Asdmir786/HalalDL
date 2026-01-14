import { Sidebar } from "@/components/Sidebar";
import { useNavigationStore } from "@/store/navigation";
import { DownloadsScreen } from "@/screens/DownloadsScreen";
import { PresetsScreen } from "@/screens/PresetsScreen";
import { ToolsScreen } from "@/screens/ToolsScreen";
import { LogsScreen } from "@/screens/LogsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { Toaster } from "@/components/ui/sonner";
import { PersistenceManager } from "@/components/PersistenceManager";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ToolSuccessModal } from "@/components/ToolSuccessModal";

export default function App() {
  const currentScreen = useNavigationStore((state) => state.currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case "downloads": return <DownloadsScreen />;
      case "presets": return <PresetsScreen />;
      case "tools": return <ToolsScreen />;
      case "logs": return <LogsScreen />;
      case "settings": return <SettingsScreen />;
      default: return <DownloadsScreen />;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <PersistenceManager />
      <Sidebar />
      <main className="flex-1 overflow-auto relative">
        <div key={currentScreen} className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
          {renderScreen()}
        </div>
      </main>
      <Toaster />
      <UpgradePrompt />
      <ToolSuccessModal />
    </div>
  );
}
