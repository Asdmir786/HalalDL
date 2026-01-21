import { Sidebar } from "@/components/Sidebar";
import { useNavigationStore } from "@/store/navigation";
import { Toaster } from "@/components/ui/sonner";
import { PersistenceManager } from "@/components/PersistenceManager";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { ToolSuccessModal } from "@/components/ToolSuccessModal";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/motion/PageTransition";
import { DownloadsScreen } from "@/screens/DownloadsScreen"; // Keep critical path eager
import { useTaskbarProgress } from "@/hooks/useTaskbarProgress";
import { GlobalDragDrop } from "@/components/GlobalDragDrop";
import { lazy, Suspense, useEffect, useState } from "react";
import { Cpu, Sparkles, Zap } from "lucide-react";

// Lazy load non-critical screens
const PresetsScreen = lazy(() => import("@/screens/PresetsScreen").then(module => ({ default: module.PresetsScreen })));
const ToolsScreen = lazy(() => import("@/screens/ToolsScreen").then(module => ({ default: module.ToolsScreen })));
const LogsScreen = lazy(() => import("@/screens/LogsScreen").then(module => ({ default: module.LogsScreen })));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen").then(module => ({ default: module.SettingsScreen })));

const LoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center bg-transparent">
    <div className="relative flex items-center justify-center">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary/40"
          animate={{
            x: [0, Math.cos(i * 60 * (Math.PI / 180)) * 40],
            y: [0, Math.sin(i * 60 * (Math.PI / 180)) * 40],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}

      <motion.div
        className="absolute h-16 w-16 rounded-full border-2 border-transparent border-t-primary/80 border-r-primary/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.div
        className="absolute h-10 w-10 rounded-full border-2 border-transparent border-b-secondary border-l-secondary/60"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute h-24 w-24"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <motion.div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          animate={{ rotate: -360, opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-4 w-4 text-primary/70 drop-shadow-[0_0_10px_rgba(var(--primary),0.35)]" />
        </motion.div>
        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2"
          animate={{ rotate: -360, opacity: [0.25, 0.75, 0.25] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.2 }}
        >
          <Zap className="h-4 w-4 text-primary/60 drop-shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
        </motion.div>
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2"
          animate={{ rotate: -360, opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.4 }}
        >
          <Sparkles className="h-4 w-4 text-primary/40 drop-shadow-[0_0_10px_rgba(var(--primary),0.25)]" />
        </motion.div>
      </motion.div>
      
      <motion.div
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 shadow-[0_0_18px_rgba(var(--primary),0.35)]"
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Cpu className="h-4 w-4 text-primary drop-shadow-[0_0_12px_rgba(var(--primary),0.35)]" />
      </motion.div>
      
      <div className="absolute inset-0 h-24 w-24 rounded-full bg-primary/5 blur-3xl -z-10" />
    </div>
  </div>
);

export default function App() {
  useTaskbarProgress();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const [isBooting, setIsBooting] = useState(true);

  // Initial boot sequence to show off the loader
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 2000); // 2 seconds boot time for 2026 aesthetic
    return () => clearTimeout(timer);
  }, []);

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
      <GlobalDragDrop />
      <PersistenceManager />
      <Sidebar />
      <main className="flex-1 overflow-hidden relative bg-gradient-to-br from-background via-background to-secondary/20">
        <AnimatePresence mode="wait">
          {isBooting ? (
             <motion.div
               key="boot-loader"
               className="h-full w-full flex items-center justify-center"
               exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
               transition={{ duration: 0.5 }}
             >
               <LoadingFallback />
             </motion.div>
          ) : (
            <PageTransition key={currentScreen} className="h-full w-full overflow-hidden">
              <Suspense fallback={<LoadingFallback />}>
                {renderScreen()}
              </Suspense>
            </PageTransition>
          )}
        </AnimatePresence>
      </main>
      <Toaster />
      <UpgradePrompt />
      <ToolSuccessModal />
    </div>
  );
}
