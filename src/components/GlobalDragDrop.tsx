import { useEffect, useState } from "react";
import { useNavigationStore } from "@/store/navigation";
import { useDownloadsStore } from "@/store/downloads";
import { Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function GlobalDragDrop() {
  const [isDragging, setIsDragging] = useState(false);
  const setScreen = useNavigationStore((state) => state.setScreen);
  const setPendingUrl = useDownloadsStore((state) => state.setPendingUrl);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      if (dragCounter === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter = 0;

      const items = e.dataTransfer?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === "string" && items[i].type === "text/plain") {
            items[i].getAsString((str) => {
              if (str && (str.startsWith("http://") || str.startsWith("https://"))) {
                 setPendingUrl(str);
                 setScreen("downloads");
              }
            });
            break; 
          } else if (items[i].kind === "string" && items[i].type === "text/uri-list") {
             items[i].getAsString((str) => {
                if (str) {
                  setPendingUrl(str);
                  setScreen("downloads");
                }
             });
             break;
          }
        }
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [setScreen, setPendingUrl]);

  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-primary m-4 rounded-3xl pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/10">
              <Download className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight">Drop Link Here</h2>
            <p className="text-xl text-muted-foreground">
              Release to add to downloads
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
