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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { downloadDir } from "@tauri-apps/api/path";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  type Settings,
  useSettingsStore,
  Theme,
  FileCollisionAction,
} from "@/store/settings";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPEED_UNITS = [
  { label: "KB/s", value: 1, suffix: "K" },
  { label: "MB/s", value: 1024, suffix: "M" },
  { label: "GB/s", value: 1024 * 1024, suffix: "G" },
  { label: "Bytes/s", value: 1 / 1024, suffix: "" }, // Special handling
];

const SETTINGS_KEY_SET = new Set(SETTINGS_KEYS as unknown as string[]);

const pickKnownSettings = (value: unknown): Settings => {
  const source = (value ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of SETTINGS_KEYS) {
    const v = source[key as string];
    if (typeof v !== "undefined") next[key as string] = v;
  }
  return next as unknown as Settings;
};

const resolveDefaultSettings = async (): Promise<Settings> => {
  const next: Settings = { ...DEFAULT_SETTINGS };
  try {
    next.defaultDownloadDir = await downloadDir();
  } catch {
    next.defaultDownloadDir = DEFAULT_SETTINGS.defaultDownloadDir;
  }
  return next;
};

export function SettingsScreen() {
  const { settings, setSettings } = useSettingsStore();

  const savedSettings = useMemo(() => pickKnownSettings(settings), [settings]);
  const [edits, setEdits] = useState<Partial<Settings>>({});
  const draftSettings = useMemo(
    () => ({ ...savedSettings, ...edits }),
    [edits, savedSettings]
  );

  const [resolvedDefaults, setResolvedDefaults] = useState<Settings | null>(null);

  // Speed Limit Local State (to handle units)
  const [speedUnit, setSpeedUnit] = useState<number>(1); // Default to KB/s (multiplier)
  const [localSpeedValue, setLocalSpeedValue] = useState<number>(0);

  // Sync local speed state with draftSettings.maxSpeed on mount or change
  useEffect(() => {
    const rawKb = draftSettings.maxSpeed || 0;
    
    // Use setTimeout to avoid synchronous state update warning during render
    const timer = setTimeout(() => {
      if (rawKb === 0) {
         setLocalSpeedValue(0);
         return;
      }
  
      const val = rawKb / speedUnit;
      setLocalSpeedValue(parseFloat(val.toFixed(2)));
    }, 0);

    return () => clearTimeout(timer);
  }, [draftSettings.maxSpeed, speedUnit]);

  const updateSpeed = (val: number, unitMult: number) => {
     // Convert to KB for storage
     // val * unitMult = KB
     const kb = val * unitMult;
     setDraftValue("maxSpeed", Math.round(kb)); // yt-dlp likes integers usually, but float K is okay? stick to int KB
  };

  useEffect(() => {
    let mounted = true;
    resolveDefaultSettings()
      .then((defaults) => {
        if (mounted) setResolvedDefaults(defaults);
      })
      .catch(() => {
        if (mounted) setResolvedDefaults(DEFAULT_SETTINGS);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const hasExtraSavedKeys = useMemo(() => {
    const raw = settings as unknown as Record<string, unknown>;
    return Object.keys(raw).some((k) => !SETTINGS_KEY_SET.has(k));
  }, [settings]);

  const isDirty = useMemo(() => {
    return SETTINGS_KEYS.some((k) => !Object.is(draftSettings[k], savedSettings[k]));
  }, [draftSettings, savedSettings]);

  const isGlobalDirty = useMemo(() => {
    if (hasExtraSavedKeys) return true;
    if (!resolvedDefaults) return false;
    return SETTINGS_KEYS.some((k) => !Object.is(savedSettings[k], resolvedDefaults[k]));
  }, [hasExtraSavedKeys, resolvedDefaults, savedSettings]);

  const setDraftValue = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setEdits((prev) => {
        const next = { ...prev } as Partial<Settings>;
        if (Object.is(value, savedSettings[key])) {
          delete (next as Record<string, unknown>)[key as string];
        } else {
          (next as Record<string, unknown>)[key as string] = value;
        }
        return next;
      });
    },
    [savedSettings]
  );

  const applyTheme = useCallback((theme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, []);

  useEffect(() => {
    applyTheme(draftSettings.theme);
    return () => applyTheme(savedSettings.theme);
  }, [applyTheme, draftSettings.theme, savedSettings.theme]);

  const handleSave = useCallback(() => {
    if (!isDirty) return;
    setSettings({ ...(settings as unknown as Record<string, unknown>), ...draftSettings } as unknown as Settings);
    setEdits({});
    toast.success("Settings saved successfully");
  }, [draftSettings, isDirty, setSettings, settings]);

  const handleGlobalReset = useCallback(async () => {
    const defaults = resolvedDefaults ?? (await resolveDefaultSettings());
    setSettings(defaults);
    setEdits({});
    toast.info("Settings restored to defaults");
  }, [resolvedDefaults, setSettings]);

  const setDraftFromSettings = useCallback(
    (nextDraft: Settings) => {
      setEdits(() => {
        const next: Partial<Settings> = {};
        for (const k of SETTINGS_KEYS) {
          if (!Object.is(nextDraft[k], savedSettings[k])) {
            (next as Record<string, unknown>)[k as string] = nextDraft[k];
          }
        }
        return next;
      });
    },
    [savedSettings]
  );

  const resetAllDraft = useCallback(async () => {
    const defaults = await resolveDefaultSettings();
    setDraftFromSettings(defaults);
    toast.info("Settings reset to defaults");
  }, [setDraftFromSettings]);

  const resetGroupDraft = useCallback(
    async (group: "appearance" | "storage" | "behavior" | "downloadEngine") => {
      const defaults = group === "storage" ? await resolveDefaultSettings() : DEFAULT_SETTINGS;
      const partial: Partial<Settings> =
        group === "appearance"
          ? { theme: defaults.theme }
          : group === "storage"
          ? { defaultDownloadDir: defaults.defaultDownloadDir, tempDir: defaults.tempDir }
          : group === "behavior"
          ? { notifications: defaults.notifications, autoClearFinished: defaults.autoClearFinished }
          : {
              maxConcurrency: defaults.maxConcurrency,
              maxRetries: defaults.maxRetries,
              maxSpeed: defaults.maxSpeed,
              fileCollision: defaults.fileCollision,
            };

      setDraftFromSettings({ ...draftSettings, ...partial });
      toast.info("Settings reset to defaults");
    },
    [draftSettings, setDraftFromSettings]
  );

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto h-full overflow-auto pb-20">
      <FadeInStagger className="space-y-8">
        <FadeInItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Settings
          </h2>
          <p className="text-muted-foreground">Configure HalalDL behavior and appearance.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <MotionButton
            variant="outline"
            size="sm"
            disabled={!isGlobalDirty}
            onClick={handleGlobalReset}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Restore Defaults
          </MotionButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!isDirty}>
              <MotionButton 
                variant="outline" 
                size="sm"
                disabled={!isDirty}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </MotionButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={resetAllDraft}>Reset all</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => resetGroupDraft("appearance")}>Reset appearance</DropdownMenuItem>
              <DropdownMenuItem onClick={() => resetGroupDraft("storage")}>Reset storage</DropdownMenuItem>
              <DropdownMenuItem onClick={() => resetGroupDraft("behavior")}>Reset behavior</DropdownMenuItem>
              <DropdownMenuItem onClick={() => resetGroupDraft("downloadEngine")}>Reset download engine</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <MotionButton 
            onClick={handleSave}
            size="sm"
            disabled={!isDirty}
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
                value={draftSettings.theme} 
                onValueChange={(v) => setDraftValue("theme", v as Theme)}
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
                  value={draftSettings.defaultDownloadDir || ""} 
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
                      setDraftValue("defaultDownloadDir", selected);
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
                checked={draftSettings.notifications}
                onCheckedChange={(checked) => setDraftValue("notifications", checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Clear Completed</Label>
                <p className="text-sm text-muted-foreground">Automatically remove finished downloads from the list.</p>
              </div>
              <Switch
                checked={draftSettings.autoClearFinished}
                onCheckedChange={(checked) => setDraftValue("autoClearFinished", checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Save className="w-4 h-4 text-green-500" />
                  Paranoid Backup Mode
                </Label>
                <p className="text-sm text-muted-foreground">Automatically backup download history to Documents/HalalDL/backups.</p>
              </div>
              <Switch
                checked={draftSettings.paranoidMode}
                onCheckedChange={(checked) => setDraftValue("paranoidMode", checked)}
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
                  {draftSettings.maxConcurrency}
                </span>
                <Slider
                  className="w-40"
                  min={1}
                  max={8}
                  step={1}
                  value={[draftSettings.maxConcurrency]}
                  onValueChange={([value]) =>
                    setDraftValue("maxConcurrency", value)
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
                <span className="font-mono font-bold text-primary">{draftSettings.maxConcurrency}</span>
              </div>
              <Slider 
                value={[draftSettings.maxConcurrency]} 
                min={1} 
                max={10} 
                step={1}
                onValueChange={([v]: number[]) => setDraftValue("maxConcurrency", v)}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="space-y-0.5">
                  <Label>Max Retries</Label>
                  <p className="text-sm text-muted-foreground">Number of attempts if a download fails.</p>
                </div>
                <span className="font-mono font-bold text-primary">{draftSettings.maxRetries}</span>
              </div>
              <Slider 
                value={[draftSettings.maxRetries]} 
                min={0} 
                max={5} 
                step={1}
                onValueChange={([v]: number[]) => setDraftValue("maxRetries", v)}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between">
                <div className="space-y-0.5">
                  <Label>Speed Limit</Label>
                  <p className="text-sm text-muted-foreground">Limit download speed (0 = unlimited).</p>
                </div>
                <span className="font-mono font-bold text-primary">
                  {draftSettings.maxSpeed === 0 ? "Unlimited" : `${localSpeedValue} ${SPEED_UNITS.find(u => u.value === speedUnit)?.label}`}
                </span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 flex gap-2">
                   <Input
                      type="number"
                      min={0}
                      value={localSpeedValue}
                      onChange={(e) => updateSpeed(parseFloat(e.target.value) || 0, speedUnit)}
                      className="flex-1"
                   />
                   <Select 
                      value={speedUnit.toString()} 
                      onValueChange={(v) => {
                        const newUnit = parseFloat(v);
                        setSpeedUnit(newUnit);
                        // Recalculate local value immediately not needed as effect will run, 
                        // BUT effect runs on draftSettings.maxSpeed change.
                        // If we just change unit, maxSpeed doesn't change, so localValue must update.
                        // Actually, if we change unit, we usually want to KEEP the maxSpeed (KB) constant and show different number?
                        // OR keep the number constant and change maxSpeed?
                        // Usually "Convert this value to new unit" -> keep maxSpeed constant.
                        // The effect handles this: rawKb / newUnit
                      }}
                   >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPEED_UNITS.map((u) => (
                        <SelectItem key={u.label} value={u.value.toString()}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                   </Select>
                </div>
              </div>
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
                value={draftSettings.fileCollision} 
                onValueChange={(v) => setDraftValue("fileCollision", v as FileCollisionAction)}
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
