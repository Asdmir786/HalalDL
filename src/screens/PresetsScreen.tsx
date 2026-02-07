import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { MotionButton } from "@/components/motion/MotionButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePresetsStore, type Preset } from "@/store/presets";
import { 
  Download, 
  Upload, 
  Plus,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useLayoutEffect, useRef, useState, type UIEvent } from "react";
import { PresetEditor } from "@/components/PresetEditor";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { PresetCard } from "./presets/components/PresetCard";
import { useLogsStore } from "@/store/logs";

export function PresetsScreen() {
  const { presets, duplicatePreset, deletePreset, updatePreset, addPreset } = usePresetsStore();
  const addLog = useLogsStore((state) => state.addLog);
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  const builtInPresets = presets.filter((p) => p.isBuiltIn);
  const userPresets = presets.filter((p) => !p.isBuiltIn);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = JSON.stringify(userPresets, null, 2);
      const path = await save({
        filters: [{ name: "JSON", extensions: ["json"] }],
        defaultPath: "presets.json",
      });
      if (path) {
        await invoke("write_text_file", { path, contents: data });
        toast.success("Presets exported successfully");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      addLog({ level: "error", message: `Presets export failed: ${message}` });
      toast.error(`Export failed: ${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const path = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });
      if (path && !Array.isArray(path)) {
        const content = await invoke<string>("read_text_file", { path });
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
      addLog({ level: "error", message: `Presets import failed: ${message}` });
      toast.error(`Import failed: ${message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <FadeInItem>
          <header className="p-8 pb-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Presets</h2>
                <p className="text-muted-foreground text-sm">
                  Configure and manage your custom download profiles.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleImport}
                  disabled={isImporting}
                  className="h-9"
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  {isImporting ? "Importing..." : "Import"}
                </MotionButton>
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="h-9"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {isExporting ? "Exporting..." : "Export"}
                </MotionButton>
                <MotionButton
                  size="sm"
                  onClick={() => {
                    setEditingPreset(null);
                    setIsEditorOpen(true);
                  }}
                  className="h-9 shadow-md"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Preset
                </MotionButton>
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
            <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl h-11">
              <TabsTrigger value="all" className="rounded-lg px-6 h-9">All Presets</TabsTrigger>
              <TabsTrigger value="built-in" className="rounded-lg px-6 h-9">Built-in</TabsTrigger>
              <TabsTrigger value="user" className="rounded-lg px-6 h-9">My Presets</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {presets.map((p) => (
                  <PresetCard 
                      key={p.id} 
                      preset={p} 
                      onDuplicate={duplicatePreset}
                      onEdit={(p) => {
                          setEditingPreset(p);
                          setIsEditorOpen(true);
                      }}
                      onDelete={deletePreset}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="built-in" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {builtInPresets.map((p) => (
                  <PresetCard 
                      key={p.id} 
                      preset={p} 
                      onDuplicate={duplicatePreset}
                      onEdit={(p) => {
                          setEditingPreset(p);
                          setIsEditorOpen(true);
                      }}
                      onDelete={deletePreset}
                  />
                ))}
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
                   <MotionButton onClick={() => setIsEditorOpen(true)}>
                     Create your first preset
                   </MotionButton>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {userPresets.map((p) => (
                      <PresetCard 
                          key={p.id} 
                          preset={p} 
                          onDuplicate={duplicatePreset}
                          onEdit={(p) => {
                              setEditingPreset(p);
                              setIsEditorOpen(true);
                          }}
                          onDelete={deletePreset}
                      />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          </div>
        </FadeInItem>

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
      </FadeInStagger>
    </div>
  );
}
