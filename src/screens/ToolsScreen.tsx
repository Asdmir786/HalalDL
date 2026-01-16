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
  Package
} from "lucide-react";

import { open as openUrl } from "@tauri-apps/plugin-shell";
import { pickFile, checkYtDlpVersion, checkFfmpegVersion, checkAria2Version, checkDenoVersion } from "@/lib/commands";
import { toast } from "sonner";

const TOOL_URLS: Record<string, string> = {
  "yt-dlp": "https://github.com/yt-dlp/yt-dlp",
  "ffmpeg": "https://ffmpeg.org/",
  "aria2": "https://aria2.github.io/",
  "deno": "https://deno.land/"
};

export function ToolsScreen() {
  const { tools, updateTool } = useToolsStore();
  const isLite = import.meta.env.VITE_APP_MODE !== "FULL";

  const testTool = async (id: string) => {
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
        toast.success(`${id} detected: ${version}`);
      } else {
        toast.error(`${id} not found`);
      }
    } catch {
      updateTool(id, { status: "Missing" });
      toast.error(`Error testing ${id}`);
    }
  };

  const ToolCard = ({ tool }: { tool: Tool }) => (
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
              {tool.version || "Version not detected"}
            </CardDescription>
          </div>
          <Badge 
            variant={tool.status === "Detected" ? "default" : tool.status === "Checking" ? "outline" : "destructive"}
            className="gap-1 flex-shrink-0"
          >
            {tool.status === "Detected" ? <CheckCircle2 className="w-3 h-3" /> : tool.status === "Checking" ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
            <span className="text-[10px]">{tool.status}</span>
          </Badge>
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
                        updateTool(tool.id, { path });
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
              placeholder="C:\path\to\tool.exe" 
              className="h-8 text-xs bg-background"
              onChange={(e) => updateTool(tool.id, { path: e.target.value })}
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
          disabled={tool.status === "Checking"}
        >
          <RefreshCcw className={`w-3 h-3 mr-1 ${tool.status === "Checking" ? "animate-spin" : ""}`} />
          Test
        </MotionButton>
        <MotionButton 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          onClick={() => openUrl(TOOL_URLS[tool.id] || "https://github.com")}
        >
          <ExternalLink className="w-3 h-3" />
        </MotionButton>
      </CardFooter>
    </Card>
  );

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <FadeInItem>
          <header className="p-8 pb-6 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Tools Manager</h2>
                <p className="text-muted-foreground text-sm">
                  Manage external binaries required for media downloading and processing.
                </p>
              </div>
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
          </header>
        </FadeInItem>

        <FadeInItem className="flex-1 overflow-auto px-8 pb-8">
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
        </FadeInItem>
      </FadeInStagger>
    </div>
  );
}
