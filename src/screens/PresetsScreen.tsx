import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePresetsStore, type Preset } from "@/store/presets";
import { 
  Copy, 
  Trash2, 
  FileEdit, 
  Download, 
  Upload, 
  Lock,
  Plus
} from "lucide-react";
import { toast } from "sonner";

export function PresetsScreen() {
  const { presets, duplicatePreset, deletePreset } = usePresetsStore();

  const builtInPresets = presets.filter((p) => p.isBuiltIn);
  const userPresets = presets.filter((p) => !p.isBuiltIn);

  const handleExport = () => {
    const data = JSON.stringify(userPresets, null, 2);
    // Logic for actual file saving would go here (Tauri FS)
    console.log("Exporting:", data);
    toast.success("User presets exported to JSON");
  };

  const handleImport = () => {
    // Logic for file picking would go here (Tauri dialog)
    toast.info("Importing JSON...");
  };

  const PresetCard = ({ preset }: { preset: Preset }) => (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg">{preset.name}</CardTitle>
          {preset.isBuiltIn ? (
            <Badge variant="secondary" className="gap-1 shrink-0">
              <Lock className="w-3 h-3" />
              Built-in
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0">User</Badge>
          )}
        </div>
        <CardDescription>{preset.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="bg-muted p-3 rounded-md font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">
          yt-dlp {preset.args.join(" ")}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => {
            duplicatePreset(preset.id);
            toast.success(`Duplicated ${preset.name}`);
          }}
        >
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </Button>
        {!preset.isBuiltIn && (
          <>
            <Button variant="outline" size="sm">
              <FileEdit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-destructive hover:text-destructive"
              onClick={() => {
                deletePreset(preset.id);
                toast.error(`Deleted ${preset.name}`);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto h-full overflow-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Presets</h2>
          <p className="text-muted-foreground">Manage your yt-dlp download configurations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleImport}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Preset
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Presets</TabsTrigger>
          <TabsTrigger value="built-in">Built-in</TabsTrigger>
          <TabsTrigger value="user">User Created</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {presets.map((p) => <PresetCard key={p.id} preset={p} />)}
        </TabsContent>
        <TabsContent value="built-in" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {builtInPresets.map((p) => <PresetCard key={p.id} preset={p} />)}
        </TabsContent>
        <TabsContent value="user" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {userPresets.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              No user presets found. Duplicate a built-in one to get started!
            </div>
          ) : (
            userPresets.map((p) => <PresetCard key={p.id} preset={p} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
