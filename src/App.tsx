import { Sidebar } from "@/components/Sidebar";
import { useNavigationStore } from "@/store/navigation";
import { Toaster } from "@/components/ui/sonner";
import { PersistenceManager } from "@/components/PersistenceManager";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ToolSuccessModal } from "@/components/ToolSuccessModal";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/motion/PageTransition";
import { DownloadsScreen } from "@/screens/DownloadsScreen";
import { PresetsScreen } from "@/screens/PresetsScreen";
import { ToolsScreen } from "@/screens/ToolsScreen";
import { LogsScreen } from "@/screens/LogsScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";

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
      <main className="flex-1 overflow-hidden relative bg-gradient-to-br from-background via-background to-secondary/20">
        <AnimatePresence mode="wait">
          <PageTransition key={currentScreen} className="h-full w-full overflow-hidden">
            {renderScreen()}
          </PageTransition>
        </AnimatePresence>
      </main>
      <Toaster />
      <UpgradePrompt />
      <ToolSuccessModal />
    </div>
  );
}
