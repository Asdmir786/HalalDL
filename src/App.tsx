import { Sidebar } from "@/components/Sidebar";
import { useNavigationStore } from "@/store/navigation";

// Screen Placeholders
const DownloadsScreen = () => <div className="p-8">Downloads Screen Skeleton</div>;
const PresetsScreen = () => <div className="p-8">Presets Screen Skeleton</div>;
const ToolsScreen = () => <div className="p-8">Tools Manager Skeleton</div>;
const LogsScreen = () => <div className="p-8">Logs & Diagnostics Skeleton</div>;
const SettingsScreen = () => <div className="p-8">Settings Skeleton</div>;

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
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {renderScreen()}
      </main>
    </div>
  );
}
