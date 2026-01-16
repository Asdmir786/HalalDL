import { 
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Monitor, 
  Zap, 
  FileWarning,
  RotateCcw,
  Save,
  Folder,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { useSettingsStore, Theme, FileCollisionAction } from "@/store/settings";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  const handleReset = () => {
    resetSettings();
    toast.info("Settings reset to defaults");
  };

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto h-full overflow-auto pb-20">
      <FadeInStagger className="space-y-8">
        <FadeInItem className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Settings
          </h2>
          <p className="text-muted-foreground">Configure HalalDL behavior and appearance.</p>
        </div>
        <div className="flex gap-2">
          <MotionButton 
            variant="outline" 
            onClick={handleReset}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Defaults
          </MotionButton>
          <MotionButton 
            onClick={handleSave}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </MotionButton>
        </div>
        </FadeInItem>

        <div className="grid gap-6">
        {/* Appearance Section */}
          <FadeInItem>
            <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>How HalalDL looks on your screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">Choose your preferred color theme.</p>
              </div>
              <Select 
                value={settings.theme} 
                onValueChange={(v) => updateSettings({ theme: v as Theme })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" /> Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" /> Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" /> System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
          </FadeInItem>

          {/* Behavior Section */}
          <FadeInItem>
            <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Storage
            </CardTitle>
            <CardDescription>Where your downloads are saved.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Default Download Directory</Label>
              <div className="flex gap-2">
                <Input 
                  value={settings.defaultDownloadDir || ""} 
                  readOnly 
                  placeholder="Select a folder..."
                  className="bg-muted"
                />
                <MotionButton 
                  variant="outline" 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                    });
                    if (selected && !Array.isArray(selected)) {
                      updateSettings({ defaultDownloadDir: selected });
                    }
                  }}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Browse
                </MotionButton>
              </div>
            </div>
          </CardContent>
        </Card>
        </FadeInItem>

        {/* Behavior Section */}
        <FadeInItem>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" />
              Behavior
            </CardTitle>
            <CardDescription>App notifications and background tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Desktop Notifications</Label>
                <p className="text-sm text-muted-foreground">Show alerts when downloads complete or fail.</p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) => updateSettings({ notifications: checked })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Clear Completed</Label>
                <p className="text-sm text-muted-foreground">Automatically remove finished downloads from the list.</p>
              </div>
              <Switch
                checked={settings.autoClearFinished}
                onCheckedChange={(checked) => updateSettings({ autoClearFinished: checked })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Max Concurrent Downloads</Label>
                <p className="text-sm text-muted-foreground">
                  Limit how many downloads run at the same time.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {settings.maxConcurrency}
                </span>
                <Slider
                  className="w-40"
                  min={1}
                  max={8}
                  step={1}
                  value={[settings.maxConcurrency]}
                  onValueChange={([value]) =>
                    updateSettings({ maxConcurrency: value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
        </FadeInItem>

        {/* Download Engine Section */}
        <FadeInItem>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Download Engine
            </CardTitle>
            <CardDescription>Control concurrency and retry logic for yt-dlp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="space-y-0.5">
                  <Label>Max Concurrent Downloads</Label>
                  <p className="text-sm text-muted-foreground">Number of videos to download at once.</p>
                </div>
                <span className="font-mono font-bold text-primary">{settings.maxConcurrency}</span>
              </div>
              <Slider 
                value={[settings.maxConcurrency]} 
                min={1} 
                max={10} 
                step={1}
                onValueChange={([v]: number[]) => updateSettings({ maxConcurrency: v })}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="space-y-0.5">
                  <Label>Max Retries</Label>
                  <p className="text-sm text-muted-foreground">Number of attempts if a download fails.</p>
                </div>
                <span className="font-mono font-bold text-primary">{settings.maxRetries}</span>
              </div>
              <Slider 
                value={[settings.maxRetries]} 
                min={0} 
                max={5} 
                step={1}
                onValueChange={([v]: number[]) => updateSettings({ maxRetries: v })}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <FileWarning className="w-4 h-4 text-yellow-500" />
                  File Collision
                </Label>
                <p className="text-sm text-muted-foreground">What to do if a file already exists.</p>
              </div>
              <Select 
                value={settings.fileCollision} 
                onValueChange={(v) => updateSettings({ fileCollision: v as FileCollisionAction })}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overwrite">Overwrite</SelectItem>
                  <SelectItem value="rename">Rename (Auto-increment)</SelectItem>
                  <SelectItem value="skip">Skip</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        </FadeInItem>
      </div>
      </FadeInStagger>
    </div>
  );
}
