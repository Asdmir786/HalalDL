import { Gauge } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useEffect, useState } from "react";

const SPEED_UNITS = [
  { label: "KB/s", value: 1, suffix: "K" },
  { label: "MB/s", value: 1024, suffix: "M" },
  { label: "GB/s", value: 1024 * 1024, suffix: "G" },
  { label: "Bytes/s", value: 1 / 1024, suffix: "" },
];

interface EngineSectionProps {
  maxConcurrency: number;
  onMaxConcurrencyChange: (val: number) => void;
  maxRetries: number;
  onMaxRetriesChange: (val: number) => void;
  maxSpeed: number;
  onMaxSpeedChange: (val: number) => void;
}

export function EngineSection({
  maxConcurrency, onMaxConcurrencyChange,
  maxRetries, onMaxRetriesChange,
  maxSpeed, onMaxSpeedChange
}: EngineSectionProps) {
  
  // Speed Limit Local State (to handle units)
  const [speedUnit, setSpeedUnit] = useState<number>(1); // Default to KB/s (multiplier)
  const [localSpeedValue, setLocalSpeedValue] = useState<number>(0);

  // Sync local speed state with maxSpeed on mount or change
  useEffect(() => {
    const rawKb = maxSpeed || 0;
    
    const timer = setTimeout(() => {
      if (rawKb === 0) {
         setLocalSpeedValue(0);
         return;
      }
  
      const val = rawKb / speedUnit;
      setLocalSpeedValue(parseFloat(val.toFixed(2)));
    }, 0);

    return () => clearTimeout(timer);
  }, [maxSpeed, speedUnit]);

  const updateSpeed = (val: number, unitMult: number) => {
     // Convert to KB for storage
     // val * unitMult = KB
     const kb = val * unitMult;
     onMaxSpeedChange(Math.round(kb));
  };

  return (
    <FadeInItem>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            Download Engine
          </CardTitle>
          <CardDescription>Concurrency, retries, and speed limits for yt-dlp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between">
              <div className="space-y-0.5">
                <Label>Max Concurrent Downloads</Label>
                <p className="text-sm text-muted-foreground">Number of videos to download at once.</p>
              </div>
              <span className="font-mono font-bold text-primary">{maxConcurrency}</span>
            </div>
            <Slider 
              value={[maxConcurrency]} 
              min={1} 
              max={10} 
              step={1}
              onValueChange={([v]: number[]) => onMaxConcurrencyChange(v)}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex justify-between">
              <div className="space-y-0.5">
                <Label>Max Retries</Label>
                <p className="text-sm text-muted-foreground">Number of attempts if a download fails.</p>
              </div>
              <span className="font-mono font-bold text-primary">{maxRetries}</span>
            </div>
            <Slider 
              value={[maxRetries]} 
              min={0} 
              max={5} 
              step={1}
              onValueChange={([v]: number[]) => onMaxRetriesChange(v)}
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
                {maxSpeed === 0 ? "Unlimited" : `${localSpeedValue} ${SPEED_UNITS.find(u => u.value === speedUnit)?.label}`}
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
        </CardContent>
      </Card>
    </FadeInItem>
  );
}
