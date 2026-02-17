import { Palette, Monitor, Sun, Moon, Check } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Theme, AccentColor, ACCENT_COLORS } from "@/store/settings";

interface AppearanceSectionProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  accentColor: AccentColor;
  onAccentColorChange: (color: AccentColor) => void;
}

export function AppearanceSection({ theme, onThemeChange, accentColor, onAccentColorChange }: AppearanceSectionProps) {
  return (
    <FadeInItem>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Appearance
          </CardTitle>
          <CardDescription>Theme, colors, and visual preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">Choose between light, dark, or follow your system.</p>
            </div>
            <Select 
              value={theme} 
              onValueChange={(v) => onThemeChange(v as Theme)}
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

          <Separator />

          <div className="space-y-3">
            <div className="space-y-0.5">
              <Label>Accent Color</Label>
              <p className="text-sm text-muted-foreground">Pick a primary color used for buttons, links, and highlights.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  title={color.label}
                  onClick={() => onAccentColorChange(color.id)}
                  className={cn(
                    "relative w-9 h-9 rounded-full border-2 transition-all duration-200 cursor-pointer",
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
        </CardContent>
      </Card>
    </FadeInItem>
  );
}
