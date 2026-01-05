import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDownloadsStore } from "@/store/downloads";
import { useVirtualizer } from "@tanstack/react-virtual";
import { 
  Plus, 
  Pause, 
  Play, 
  X, 
  FolderOpen,
  Download
} from "lucide-react";

export function DownloadsScreen() {
  const [url, setUrl] = useState("");
  const { jobs, addJob, removeJob } = useDownloadsStore();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const handleAdd = () => {
    if (!url.trim()) return;
    addJob(url, "default");
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
          <Select defaultValue="default">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Global Default</SelectItem>
              <SelectItem value="high-quality">High Quality (4K)</SelectItem>
              <SelectItem value="mp3">Audio Only (MP3)</SelectItem>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {job.status === "Downloading" ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
