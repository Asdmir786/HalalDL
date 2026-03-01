import { Gauge, Layers, RotateCcw, Zap } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";

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
  maxSpeed, onMaxSpeedChange,
}: EngineSectionProps) {
  const [speedUnit, setSpeedUnit] = useState<number>(1);
  const [localSpeedValue, setLocalSpeedValue] = useState<number>(0);

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
    const kb = val * unitMult;
    onMaxSpeedChange(Math.round(kb));
  };

  return (
    <SettingsSection id="engine" icon={Gauge} title="Download Engine" description="Concurrency, retries, and speed limits for yt-dlp.">
      <SettingRow icon={Layers} label="Max Concurrent Downloads" description="Number of videos to download at once." vertical>
        <div className="flex items-center gap-4">
          <Slider
            value={[maxConcurrency]}
            min={1}
            max={10}
            step={1}
            onValueChange={([v]: number[]) => onMaxConcurrencyChange(v)}
            className="flex-1"
          />
          <AnimatePresence mode="popLayout">
            <motion.span
              key={maxConcurrency}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-mono font-bold text-primary text-sm w-6 text-center"
            >
              {maxConcurrency}
            </motion.span>
          </AnimatePresence>
        </div>
      </SettingRow>

      <SettingRow icon={RotateCcw} label="Max Retries" description="Number of attempts if a download fails." vertical>
        <div className="flex items-center gap-4">
          <Slider
            value={[maxRetries]}
            min={0}
            max={5}
            step={1}
            onValueChange={([v]: number[]) => onMaxRetriesChange(v)}
            className="flex-1"
          />
          <AnimatePresence mode="popLayout">
            <motion.span
              key={maxRetries}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-mono font-bold text-primary text-sm w-6 text-center"
            >
              {maxRetries}
            </motion.span>
          </AnimatePresence>
        </div>
      </SettingRow>

      <SettingRow icon={Zap} label="Speed Limit" description="Limit download speed (0 = unlimited)." vertical>
        <div className="flex items-center gap-3">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={maxSpeed === 0 ? "unlimited" : `${localSpeedValue}`}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="font-mono font-bold text-primary text-xs shrink-0 min-w-[80px]"
            >
              {maxSpeed === 0 ? "Unlimited" : `${localSpeedValue} ${SPEED_UNITS.find(u => u.value === speedUnit)?.label}`}
            </motion.span>
          </AnimatePresence>
          <Input
            type="number"
            min={0}
            value={localSpeedValue}
            onChange={(e) => updateSpeed(parseFloat(e.target.value) || 0, speedUnit)}
            className="flex-1 bg-muted/30 border-border/30"
          />
          <Select
            value={speedUnit.toString()}
            onValueChange={(v) => setSpeedUnit(parseFloat(v))}
          >
            <SelectTrigger className="w-[90px]">
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
      </SettingRow>
    </SettingsSection>
  );
}
