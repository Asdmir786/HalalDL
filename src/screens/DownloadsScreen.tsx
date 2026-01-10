import { useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { 
  Plus, 
  X, 
  FolderOpen,
  Download,
  RotateCcw
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
import { startDownload } from "@/lib/downloader";
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
    <div className="flex flex-col h-full bg-background">
      {/* Top Section */}
      <header className="p-6 border-b space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Downloads</h2>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Paste video or playlist URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="pr-10"
            />
          </div>
          <Select value={selectedPreset} onValueChange={setSelectedPreset}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Preset" />
            </SelectTrigger>
            <SelectContent>
              {presets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!url.trim()}>
            <Plus className="w-4 h-4 mr-2" />
            Add to Queue
          </Button>
        </div>
      </header>

      {/* Queue Section */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {jobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Download className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium">Your queue is empty</p>
            <p className="text-sm max-w-[250px]">Paste a URL above to start downloading media.</p>
          </div>
        ) : (
          <div 
            ref={parentRef}
            className="flex-1 overflow-auto p-6"
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const job = jobs[virtualItem.index];
                return (
                  <div
                    key={job.id}
                    className="absolute top-0 left-0 w-100 p-4 mb-4 border rounded-lg bg-card shadow-sm"
                    style={{
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2 gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">
                          {job.title || job.url}
                        </h4>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {job.status}
                          </Badge>
                          {job.speed && (
                            <span className="text-[10px] text-muted-foreground">
                              {job.speed} • {job.eta}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {job.status === "Failed" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-500"
                            onClick={() => startDownload(job.id)}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          disabled={!job.outputPath}
                          onClick={() => job.outputPath && revealInExplorer(job.outputPath)}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeJob(job.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
