import { useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { 
  Plus, 
  X, 
  FolderOpen,
  Download
} from "lucide-react";
import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { revealInExplorer } from "@/lib/commands";

export function DownloadsScreen() {
  const [url, setUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("default");
  const { jobs, addJob, removeJob } = useDownloadsStore();
  const { presets } = usePresetsStore();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const handleAdd = () => {
    if (!url.trim()) return;
    addJob(url, selectedPreset);
    setUrl("");
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full">
      {/* Top Section */}
      <header className="p-8 pb-6 space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight">Downloads</h2>
          <p className="text-muted-foreground text-sm">Add URLs to start downloading your media.</p>
        </div>
        
        <div className="flex gap-3 bg-muted/30 p-2 rounded-xl border border-muted/50 shadow-sm">
          <div className="flex-1 relative">
            <Input
              placeholder="Paste video or playlist URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="pr-10 bg-background border-none shadow-none focus-visible:ring-1"
            />
          </div>
          <Select value={selectedPreset} onValueChange={setSelectedPreset}>
            <SelectTrigger className="w-[160px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!url.trim()} className="shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </header>

      {/* Queue Section */}
      <div className="flex-1 overflow-hidden flex flex-col px-8 pb-8">
        <div className="bg-muted/10 rounded-2xl border border-muted/50 flex-1 flex flex-col overflow-hidden shadow-inner">
          {jobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-muted/20">
                <Download className="w-10 h-10 opacity-20" />
              </div>
              <p className="text-xl font-semibold text-foreground/80 mb-2">Queue is empty</p>
              <p className="text-sm max-w-[280px] opacity-70">
                Media you add will appear here. We support YouTube, X, Instagram, and 1000+ more.
              </p>
            </div>
          ) : (
            <div 
              ref={parentRef}
              className="flex-1 overflow-auto p-4"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const job = jobs[virtualRow.index];
                  return (
                    <div
                      key={job.id}
                      className="absolute top-0 left-0 w-full p-2"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="bg-background rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group">
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                               <h4 className="font-medium truncate pr-4 text-sm">{job.title || job.url}</h4>
                               <div className="flex items-center gap-2">
                                  <Badge variant={
                      job.status === "Done" ? "default" :
                      job.status === "Downloading" ? "secondary" :
                      job.status === "Failed" ? "destructive" : "outline"
                    } className="text-[10px] px-1.5 h-5">
                      {job.status}
                    </Badge>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-7 h-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeJob(job.id)}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                               </div>
                            </div>
                            
                            {job.status === "Downloading" && (
                              <div className="space-y-1.5">
                                <Progress value={job.progress} className="h-1.5" />
                                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                                   <span>{job.progress}% downloaded</span>
                                   <span>{job.speed || "0 KB/s"}</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1">
                               <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                  {job.presetId}
                </span>
                {job.status === "Done" && (
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-[10px] text-primary flex items-center gap-1"
                    onClick={() => revealInExplorer(job.outputPath || "")}
                  >
                    <FolderOpen className="w-3 h-3" />
                    Show in Explorer
                  </Button>
                )}
                            </div>
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
