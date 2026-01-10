import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { useToolsStore } from "@/store/tools";

interface DownloadProgress {
  tool: string;
  percentage: number;
  status: string;
}

export function UpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTool, setCurrentTool] = useState("");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Track which tools are selected for download
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  
  const { tools } = useToolsStore();
  const isFullMode = import.meta.env.VITE_APP_MODE === 'FULL';

  useEffect(() => {
    // Show prompt if ANY tool is missing
    const missingTools = tools.filter(t => t.status === "Missing");
    
    if (missingTools.length > 0) {
       // In Full Mode, we force open. In Lite, we also auto-open but allow closing.
       const timer = setTimeout(() => {
         setSelectedTools(prev => {
           if (prev.length === 0) return missingTools.map(t => t.id);
           return prev;
         });
         setOpen(true);
       }, 1000);
       return () => clearTimeout(timer);
    }
  }, [tools]);

  useEffect(() => {
    const unlisten = listen<DownloadProgress>("download-progress", (event) => {
      setCurrentTool(event.payload.tool);
      setProgress(event.payload.percentage);
      setStatusText(event.payload.status);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  const handleUpgrade = async () => {
    if (selectedTools.length === 0) {
      setOpen(false);
      return;
    }

    setIsDownloading(true);
    setError(null);
    try {
      // Map tool IDs to the names expected by Rust backend
      // Rust expects: "yt-dlp", "ffmpeg", "aria2", "deno"
      // Our store IDs are: "yt-dlp", "ffmpeg", "aria2", "deno" (from src/store/tools.ts)
      await invoke("download_tools", { tools: selectedTools });
      
      setStatusText("All selected tools ready!");
      setProgress(100);
      setTimeout(() => {
        setOpen(false);
        window.location.reload(); 
      }, 1500);
    } catch (err) {
      setError(err as string);
      setIsDownloading(false);
    }
  };

  const toggleTool = (id: string) => {
    setSelectedTools(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(val) => {
        // In Full Mode, prevent closing if tools are missing (unless we are just closing it programmatically)
        // If isDownloading is true, we also block closing.
        if (isFullMode || isDownloading) return;
        setOpen(val);
      }}
    >
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => {
        if (isFullMode || isDownloading) e.preventDefault();
      }} onEscapeKeyDown={(e) => {
        if (isFullMode || isDownloading) e.preventDefault();
      }}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle>{isFullMode ? "Complete Setup" : "Setup External Tools"}</DialogTitle>
          </div>
          <DialogDescription>
            {isFullMode 
              ? "To finish setting up HalalDL Full, please download the required tools below." 
              : "HalalDL needs external tools to function correctly. We detected some are missing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isDownloading ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 animate-bounce" />
                  <span className="capitalize">{currentTool || "Preparing..."}</span>
                </span>
                <span className="font-mono">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center italic">
                {statusText}
              </p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground mb-2 flex justify-between items-center">
                <span>Available Tools</span>
                <span className="text-xs bg-muted px-2 py-1 rounded">~50MB Total</span>
              </div>
              
              {tools.map(tool => {
                const isMissing = tool.status === "Missing";
                const isSelected = selectedTools.includes(tool.id);
                
                return (
                  <div 
                    key={tool.id} 
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                      isSelected ? "bg-accent/50 border-primary/50" : "bg-card"
                    } ${!isMissing ? "opacity-70" : ""}`}
                  >
                    <Checkbox 
                      id={tool.id} 
                      checked={!isMissing ? true : isSelected}
                      disabled={!isMissing}
                      onCheckedChange={() => toggleTool(tool.id)}
                    />
                    <div className="grid gap-1.5 leading-none flex-1">
                      <div className="flex justify-between">
                        <Label 
                          htmlFor={tool.id} 
                          className="font-semibold cursor-pointer flex items-center gap-2"
                        >
                          {tool.name}
                          {!isMissing && (
                            <span className="text-[10px] bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Installed
                            </span>
                          )}
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {tool.id === "yt-dlp" && "Required for downloading videos."}
                        {tool.id === "ffmpeg" && "Required for merging video & audio."}
                        {tool.id === "aria2" && "High-speed download accelerator."}
                        {tool.id === "deno" && "Required for some complex sites."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!isDownloading && (
            <>
              {!isFullMode && (
                <Button variant="ghost" onClick={() => setOpen(false)} className="flex-1">
                  Skip for Now
                </Button>
              )}
              <Button onClick={handleUpgrade} disabled={selectedTools.length === 0} className="flex-1 gap-2">
                <Download className="w-4 h-4" />
                {isFullMode ? "Setup Tools" : "Download Selected"}
              </Button>
            </>
          )}
          {isDownloading && progress === 100 && (
            <Button disabled className="w-full gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Finishing up...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
