import { Palette, Monitor, Sun, Moon, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Theme, AccentColor, ACCENT_COLORS } from "@/store/settings";
import { SettingsSection } from "./SettingsSection";

interface AppearanceSectionProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  accentColor: AccentColor;
  onAccentColorChange: (color: AccentColor) => void;
}

const THEMES: { id: Theme; label: string; icon: React.ComponentType<{ className?: string }>; preview: { bg: string; fg: string; accent: string } }[] = [
  { id: "light", label: "Light", icon: Sun, preview: { bg: "bg-white", fg: "bg-zinc-300", accent: "bg-zinc-400" } },
  { id: "dark", label: "Dark", icon: Moon, preview: { bg: "bg-zinc-900", fg: "bg-zinc-700", accent: "bg-zinc-500" } },
  { id: "system", label: "System", icon: Monitor, preview: { bg: "bg-gradient-to-r from-white to-zinc-900", fg: "bg-zinc-400", accent: "bg-zinc-500" } },
];

export function AppearanceSection({ theme, onThemeChange, accentColor, onAccentColorChange }: AppearanceSectionProps) {
  return (
    <SettingsSection id="appearance" icon={Palette} title="Appearance" description="Theme, colors, and visual preferences.">
      {/* Theme picker cards */}
      <div className="space-y-2.5">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onThemeChange(t.id)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 pt-4 transition-all duration-200 cursor-pointer",
                  active
                    ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                    : "border-border/40 bg-muted/10 hover:border-border/60 hover:bg-muted/20"
                )}
              >
                {/* Mini preview */}
                <div className={cn("w-full h-12 rounded-lg overflow-hidden", t.preview.bg)}>
                  <div className="flex flex-col gap-1.5 p-2">
                    <div className={cn("h-1.5 w-3/4 rounded-full", t.preview.accent)} />
                    <div className={cn("h-1 w-1/2 rounded-full", t.preview.fg)} />
                    <div className={cn("h-1 w-2/3 rounded-full", t.preview.fg)} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{t.label}</span>
                </div>
                {active && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accent color swatches */}
      <div className="space-y-2.5 rounded-xl border border-border/30 bg-muted/15 p-4">
        <div>
          <Label className="text-sm font-medium">Accent Color</Label>
          <p className="text-xs text-muted-foreground">Pick a primary color for buttons, links, and highlights.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              title={color.label}
              onClick={() => onAccentColorChange(color.id)}
              className={cn(
                "group/swatch relative w-9 h-9 rounded-full border-2 transition-all duration-200 cursor-pointer",
                "hover:scale-110 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                accentColor === color.id
                  ? "border-foreground shadow-sm scale-105"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
              style={{ backgroundColor: color.swatch }}
            >
              {accentColor === color.id && (
                <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </SettingsSection>
  );
}
