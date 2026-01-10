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
      <main className="flex-1 overflow-auto">
        {renderScreen()}
      </main>
      <Toaster />
      <UpgradePrompt />
    </div>
  );
}
