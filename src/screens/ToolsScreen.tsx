import { useToolsStore, type Tool } from "@/store/tools";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCcw, 
  Search, 
  Info,
  ExternalLink,
  ShieldCheck,
  Package,
  Loader2
} from "lucide-react";

import { open as openUrl } from "@tauri-apps/plugin-shell";
import { downloadTools, fetchLatestAria2Version, fetchLatestDenoVersion, fetchLatestFfmpegVersion, fetchLatestYtDlpVersion, isUpdateAvailable, pickFile, checkYtDlpVersion, checkFfmpegVersion, checkAria2Version, checkDenoVersion, stageManualTool } from "@/lib/commands";
import { toast } from "sonner";
import { useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { useLogsStore } from "@/store/logs";

const TOOL_URLS: Record<string, string> = {
  "yt-dlp": "https://github.com/yt-dlp/yt-dlp",
  "ffmpeg": "https://ffmpeg.org/",
  "aria2": "https://aria2.github.io/",
  "deno": "https://deno.land/"
};

export function ToolsScreen() {
  const { tools, updateTool } = useToolsStore();
  const addLog = useLogsStore((state) => state.addLog);
  const isLite = import.meta.env.VITE_APP_MODE !== "FULL";
  const [checkingTools, setCheckingTools] = useState<Record<string, boolean>>({});
  const [checkingLatest, setCheckingLatest] = useState<Record<string, boolean>>({});
  const [isUpdatingTools, setIsUpdatingTools] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  const testTool = async (id: string) => {
    setCheckingTools(prev => ({ ...prev, [id]: true }));
    updateTool(id, { status: "Checking" });
    let version: string | null = null;
    
    try {
      switch (id) {
        case "yt-dlp": version = await checkYtDlpVersion(); break;
        case "ffmpeg": version = await checkFfmpegVersion(); break;
        case "aria2": version = await checkAria2Version(); break;
        case "deno": version = await checkDenoVersion(); break;
      }
      
      updateTool(id, { 
        status: version ? "Detected" : "Missing", 
        version: version || undefined 
      });
      
      if (version) {
        addLog({ level: "info", message: `${id} detected: ${version}` });
        toast.success(`${id} detected: ${version}`);
      } else {
        addLog({ level: "warn", message: `${id} not found` });
        toast.error(`${id} not found`);
      }
    } catch (e: unknown) {
      addLog({ level: "error", message: `Tool test failed (${id}): ${e instanceof Error ? e.message : String(e)}` });
      updateTool(id, { status: "Missing" });
      toast.error(`Error testing ${id}`);
    } finally {
      setCheckingTools(prev => ({ ...prev, [id]: false }));
    }
  };

  const checkLatestForTool = async (tool: Tool) => {
    setCheckingLatest((prev) => ({ ...prev, [tool.id]: true }));
    try {
      let latest: string | null = null;
      switch (tool.id) {
        case "yt-dlp": latest = await fetchLatestYtDlpVersion(); break;
        case "ffmpeg": latest = await fetchLatestFfmpegVersion(); break;
        case "aria2": latest = await fetchLatestAria2Version(); break;
        case "deno": latest = await fetchLatestDenoVersion(); break;
      }

      updateTool(tool.id, {
        latestVersion: latest || undefined,
        updateAvailable: isUpdateAvailable(tool.version, latest || undefined),
        latestCheckedAt: Date.now(),
      });

      if (latest) {
        addLog({ level: "info", message: `${tool.id} latest: ${latest}` });
        toast.success(`${tool.id} latest: ${latest}`);
      } else {
        addLog({ level: "warn", message: `Could not fetch latest for ${tool.id}` });
        toast.error(`Could not fetch latest for ${tool.id}`);
      }
    } catch (e: unknown) {
      addLog({ level: "error", message: `Latest check failed (${tool.id}): ${e instanceof Error ? e.message : String(e)}` });
      toast.error(`Error checking latest for ${tool.id}`);
    } finally {
      setCheckingLatest((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  const checkAllLatest = async () => {
    const list = useToolsStore.getState().tools;
    await Promise.all(list.map((t) => checkLatestForTool(t)));
  };

  const updateToolNow = async (tool: Tool) => {
    if (isLite) {
      toast.info("Lite Mode: open the tool website to update.");
      await openUrl(TOOL_URLS[tool.id]);
      return;
    }

    setIsUpdatingTools((prev) => ({ ...prev, [tool.id]: true }));
    try {
      await downloadTools([tool.id]);
      addLog({ level: "info", message: `${tool.id} updated` });
      toast.success(`${tool.id} updated`);
      await testTool(tool.id);
      await checkLatestForTool({ ...tool, version: useToolsStore.getState().tools.find((t) => t.id === tool.id)?.version });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      addLog({ level: "error", message: `Tool update failed (${tool.id}): ${message}` });
      toast.error(`Update failed: ${message}`);
    } finally {
      setIsUpdatingTools((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  const ToolCard = ({ tool }: { tool: Tool }) => {
    const canInstallOrUpdate = isLite || tool.status === "Missing" || tool.updateAvailable === true;

    return (
    <Card className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow duration-200 border-muted/60 glass-card">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2 truncate">
              {tool.name}
              {tool.required && (
                <Badge variant="secondary" className="text-[9px] uppercase h-4 px-1 flex-shrink-0">
                  Required
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="font-mono text-[10px] truncate opacity-70">
              <span>Installed: {tool.version || "Unknown"}</span>
              {tool.latestVersion && <span className="ml-2">Latest: {tool.latestVersion}</span>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {tool.updateAvailable && (
              <Badge variant="secondary" className="gap-1">
                <RefreshCcw className="w-3 h-3" />
                <span className="text-[10px]">Update</span>
              </Badge>
            )}
            <Badge
              variant={tool.status === "Detected" ? "default" : tool.status === "Checking" ? "outline" : "destructive"}
              className="gap-1"
            >
              {tool.status === "Detected" ? <CheckCircle2 className="w-3 h-3" /> : tool.status === "Checking" ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              <span className="text-[10px]">{tool.status}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detection Mode</label>
          <div className="flex items-center justify-between gap-4 bg-muted/30 p-2 rounded-md">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={tool.mode === "Auto"} 
                onCheckedChange={(checked) => updateTool(tool.id, { mode: checked ? "Auto" : "Manual" })}
              />
              <span className="text-xs font-medium">Auto-detect</span>
            </div>
            {tool.mode === "Manual" && (
                  <MotionButton 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] px-2"
                    onClick={async () => {
                      const path = await pickFile();
                      if (path) {
                        try {
                          const stagedPath = await stageManualTool(tool.id, path);
                          updateTool(tool.id, { path: stagedPath });
                          addLog({ level: "info", message: `${tool.id} path set (Browse)` });
                          toast.success(`${tool.id} path set`);
                        } catch (e) {
                          const message = e instanceof Error ? e.message : String(e);
                          addLog({ level: "error", message: `Failed to set ${tool.id} path (Browse): ${message}` });
                          toast.error(`Failed to set path: ${message}`);
                        }
                      }
                    }}
                  >
                    <Search className="w-3 h-3 mr-1" />
                    Browse
                  </MotionButton>
                )}
          </div>
        </div>

        {tool.mode === "Manual" && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Custom Path</label>
            <Input 
              value={tool.path || ""} 
              placeholder="C:\\path\\to\\tool.exe" 
              className="h-8 text-xs bg-background"
              onChange={(e) => updateTool(tool.id, { path: e.target.value })}
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                const raw = (e.currentTarget.value || "").trim();
                if (!raw) return;
                try {
                  const stagedPath = await stageManualTool(tool.id, raw);
                  updateTool(tool.id, { path: stagedPath });
                  addLog({ level: "info", message: `${tool.id} path set (Manual input)` });
                  toast.success(`${tool.id} path set`);
                } catch (err) {
                  const message = err instanceof Error ? err.message : String(err);
                  addLog({ level: "error", message: `Failed to set ${tool.id} path (Manual input): ${message}` });
                  toast.error(`Failed to set path: ${message}`);
                }
              }}
            />
          </div>
        )}

        <div className="pt-2">
          <div className="text-[10px] text-muted-foreground flex flex-col gap-1">
            <span className="uppercase font-bold opacity-50">Current Path</span>
            <span className="text-foreground font-mono truncate bg-muted/50 p-1.5 rounded text-[10px]">
              {tool.path || "System Default"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 border-t p-2 flex gap-2">
        <MotionButton 
          variant="outline" 
          size="sm" 
          className="flex-1 h-8 text-xs"
          onClick={() => testTool(tool.id)}
          disabled={checkingTools[tool.id]}
        >
          {checkingTools[tool.id] ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <RefreshCcw className="w-3.5 h-3.5 mr-2" />
          )}
          {checkingTools[tool.id] ? "Checking..." : "Check Status"}
        </MotionButton>
        <MotionButton
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={() => checkLatestForTool(tool)}
          disabled={checkingLatest[tool.id]}
          title="Check latest available version"
        >
          {checkingLatest[tool.id] ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span>Latest</span>
          )}
        </MotionButton>
        <MotionButton
          variant={tool.updateAvailable ? "default" : "outline"}
          size="sm"
          className="h-8 px-3 text-xs"
          disabled={!canInstallOrUpdate || isUpdatingTools[tool.id]}
          onClick={() => updateToolNow(tool)}
          title={isLite ? "Lite Mode: open download page" : "Download and replace tool"}
        >
          {isUpdatingTools[tool.id] ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span>{isLite ? "Get" : tool.status === "Missing" ? "Install" : "Update"}</span>
          )}
        </MotionButton>
        <MotionButton 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={() => openUrl(TOOL_URLS[tool.id])}
          title="Visit Website"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </MotionButton>
      </CardFooter>
    </Card>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <FadeInItem>
          <header className="p-8 pb-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Tools Manager</h2>
                <p className="text-muted-foreground text-sm">
                  Manage external binaries required for media downloading and processing.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={checkAllLatest}
                  className="h-9"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Check Updates
                </MotionButton>
                <div className="bg-muted/20 border border-muted/30 rounded-xl p-3 flex items-center gap-3 glass-card">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Environment
                    </span>
                    <span className="text-sm font-semibold">
                      {isLite ? "Lite Mode" : "Full Mode"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>
        </FadeInItem>

        <FadeInItem className="flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-auto px-8 pb-8"
          >
          <div className="space-y-8">
          {isLite && (
            <div className="rounded-xl border border-muted/40 bg-muted/20 p-3 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lite Mode
                </div>
                <div className="text-xs text-muted-foreground">
                  Tools aren’t bundled in Lite mode. Use system PATH or set custom paths below.
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-muted/20 border-dashed">
               <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    Bypass Mode
                  </CardTitle>
                  <CardDescription className="text-xs">
                    If you have issues with auto-detection, you can force the app to use specific binary versions.
                  </CardDescription>
               </CardHeader>
            </Card>
            <Card className="bg-muted/20 border-dashed">
               <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4 text-muted-foreground" />
                    Auto-Repair
                  </CardTitle>
                  <CardDescription className="text-xs">
                    The app automatically checks for missing tools on startup and prompts for installation.
                  </CardDescription>
               </CardHeader>
            </Card>
          </div>
        </div>
          </div>
        </FadeInItem>
      </FadeInStagger>
    </div>
  );
}
