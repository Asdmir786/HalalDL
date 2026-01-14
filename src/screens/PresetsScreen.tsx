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
import { useState } from "react";
import { PresetEditor } from "@/components/PresetEditor";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, readTextFile } from "@tauri-apps/plugin-fs";

export function PresetsScreen() {
  const { presets, duplicatePreset, deletePreset, updatePreset, addPreset } = usePresetsStore();
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const builtInPresets = presets.filter((p) => p.isBuiltIn);
  const userPresets = presets.filter((p) => !p.isBuiltIn);

  const handleExport = async () => {
    try {
      const data = JSON.stringify(userPresets, null, 2);
      const path = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: "presets.json",
      });
      if (path) {
        await writeFile(path, new TextEncoder().encode(data));
        toast.success("Presets exported successfully");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      toast.error(`Export failed: ${message}`);
    }
  };

  const handleImport = async () => {
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (path && !Array.isArray(path)) {
        const content = await readTextFile(path);
        const imported = JSON.parse(content);
        if (Array.isArray(imported)) {
          imported.forEach((p) => {
            addPreset({
              ...p,
              id: crypto.randomUUID(),
              isBuiltIn: false,
            });
          });
          toast.success(`Imported ${imported.length} presets`);
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      toast.error(`Import failed: ${message}`);
    }
  };

  const PresetCard = ({ preset }: { preset: Preset }) => (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-200 border-muted/60 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg truncate">{preset.name}</CardTitle>
            <CardDescription className="text-xs line-clamp-2 h-8 leading-relaxed">
              {preset.description}
            </CardDescription>
          </div>
          {preset.isBuiltIn ? (
            <Badge variant="secondary" className="gap-1 shrink-0 bg-secondary/50 text-[10px]">
              <Lock className="w-3 h-3" />
              Built-in
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">User</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="bg-muted/30 p-3 rounded-lg border border-muted/50 font-mono text-[10px] text-muted-foreground break-all relative group">
           <div className="line-clamp-3">
              yt-dlp {preset.args.join(" ")}
           </div>
           <Button 
             variant="ghost" 
             size="icon" 
             className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
             onClick={() => {
                navigator.clipboard.writeText(`yt-dlp ${preset.args.join(" ")}`);
                toast.success("Command copied to clipboard");
             }}
           >
              <Copy className="w-3 h-3" />
           </Button>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 border-t p-2 flex gap-2 justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs px-2"
          onClick={() => {
            duplicatePreset(preset.id);
            toast.success(`Duplicated ${preset.name}`);
          }}
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          Duplicate
        </Button>
        {!preset.isBuiltIn && (
          <>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => {
                setEditingPreset(preset);
                setIsEditorOpen(true);
              }}
            >
              <FileEdit className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                deletePreset(preset.id);
                toast.error(`Deleted ${preset.name}`);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full">
      <header className="p-8 pb-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Presets</h2>
            <p className="text-muted-foreground text-sm">Configure and manage your custom download profiles.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleImport} className="h-9">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={() => {
              setEditingPreset(null);
              setIsEditorOpen(true);
            }} className="h-9 shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Create Preset
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 pb-8">
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-11">
            <TabsTrigger value="all" className="rounded-lg px-6 h-9">All Presets</TabsTrigger>
            <TabsTrigger value="built-in" className="rounded-lg px-6 h-9">Built-in</TabsTrigger>
            <TabsTrigger value="user" className="rounded-lg px-6 h-9">My Presets</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {presets.map((p) => <PresetCard key={p.id} preset={p} />)}
            </div>
          </TabsContent>

          <TabsContent value="built-in" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {builtInPresets.map((p) => <PresetCard key={p.id} preset={p} />)}
            </div>
          </TabsContent>

          <TabsContent value="user" className="mt-0">
            {userPresets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-2xl bg-muted/10">
                 <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Plus className="w-8 h-8 opacity-20" />
                 </div>
                 <h3 className="text-lg font-semibold mb-1">No custom presets yet</h3>
                 <p className="text-sm text-muted-foreground mb-6">Create your own presets to save specific download settings.</p>
                 <Button onClick={() => setIsEditorOpen(true)}>Create your first preset</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {userPresets.map((p) => <PresetCard key={p.id} preset={p} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {isEditorOpen && (
        <PresetEditor
          preset={editingPreset}
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={(data) => {
            if (editingPreset) {
              updatePreset(editingPreset.id, data);
              toast.success("Preset updated");
            } else {
              addPreset({
                name: data.name || "New Preset",
                description: data.description || "",
                args: data.args || [],
                isBuiltIn: false,
              });
              toast.success("Preset created");
            }
            setIsEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
