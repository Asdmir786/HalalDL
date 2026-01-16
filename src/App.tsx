import { Sidebar } from "@/components/Sidebar";
import { useNavigationStore } from "@/store/navigation";
import { Toaster } from "@/components/ui/sonner";
import { PersistenceManager } from "@/components/PersistenceManager";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ToolSuccessModal } from "@/components/ToolSuccessModal";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/motion/PageTransition";
import { lazy, Suspense } from "react";

const DownloadsScreen = lazy(() => import("@/screens/DownloadsScreen").then(module => ({ default: module.DownloadsScreen })));
const PresetsScreen = lazy(() => import("@/screens/PresetsScreen").then(module => ({ default: module.PresetsScreen })));
const ToolsScreen = lazy(() => import("@/screens/ToolsScreen").then(module => ({ default: module.ToolsScreen })));
const LogsScreen = lazy(() => import("@/screens/LogsScreen").then(module => ({ default: module.LogsScreen })));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen").then(module => ({ default: module.SettingsScreen })));

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
             <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
               {renderScreen()}
             </Suspense>
          </PageTransition>
        </AnimatePresence>
      </main>
      <Toaster />
      <UpgradePrompt />
      <ToolSuccessModal />
    </div>
  );
}
