import { useToolsStore, type Tool } from "@/store/tools";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export function ToolsScreen() {
  const { tools, updateTool } = useToolsStore();
  const isLite = import.meta.env.VITE_APP_MODE !== 'FULL';

  const ToolCard = ({ tool }: { tool: Tool }) => (
    <Card className="flex flex-col h-full overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              {tool.name}
              {tool.required && <Badge variant="secondary" className="text-[10px] uppercase">Required</Badge>}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {tool.version || "Version not detected"}
            </CardDescription>
          </div>
          <Badge 
            variant={tool.status === "Detected" ? "default" : "destructive"}
            className="gap-1"
          >
            {tool.status === "Detected" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {tool.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mode</label>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch 
                checked={tool.mode === "Auto"} 
                onCheckedChange={(checked) => updateTool(tool.id, { mode: checked ? "Auto" : "Manual" })}
              />
              <span className="text-sm">Auto-detect</span>
            </div>
            {tool.mode === "Manual" && (
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Search className="w-3 h-3 mr-1" />
                Browse
              </Button>
            )}
          </div>
        </div>

        {tool.mode === "Manual" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Path</label>
            <Input 
              value={tool.path || ""} 
              placeholder="C:\path\to\tool.exe" 
              className="h-8 text-xs"
              onChange={(e) => updateTool(tool.id, { path: e.target.value })}
            />
          </div>
        )}

        <div className="pt-2">
          <div className="text-xs text-muted-foreground">
            Current Path: <span className="text-foreground font-mono">{tool.path || "System Default"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 border-t p-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 h-8">
          <RefreshCcw className="w-3 h-3 mr-1" />
          Test
        </Button>
        <Button variant="ghost" size="sm" className="h-8">
          <ExternalLink className="w-3 h-3" />
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto h-full overflow-auto">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Tools Manager</h2>
          <p className="text-muted-foreground">Manage external binaries required for media downloading and processing.</p>
        </div>
        <div className="flex items-center gap-3 bg-card border rounded-lg p-2 px-4 shadow-sm">
          {isLite ? (
            <>
              <Package className="w-5 h-5 text-blue-500" />
              <div className="text-sm font-medium">HalalDL <span className="text-blue-500">Lite</span></div>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5 text-green-500" />
              <div className="text-sm font-medium">HalalDL <span className="text-green-500">Full</span></div>
            </>
          )}
        </div>
      </div>

      {isLite && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Lite Mode Active</AlertTitle>
          <AlertDescription>
            Tools are not bundled. Please ensure they are installed on your system or provide paths manually.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((t) => <ToolCard key={t.id} tool={t} />)}
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Diagnostic Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline">Re-scan All Tools</Button>
          <Button variant="outline">Reset to Defaults</Button>
          <Button variant="outline">Check for Tool Updates</Button>
        </div>
      </div>
    </div>
  );
}
