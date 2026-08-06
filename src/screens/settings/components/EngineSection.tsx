import { Cookie, Gauge, Layers, RotateCcw, Zap, Trash2, Images, Search, X } from "lucide-react";
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
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";
import { exists } from "@tauri-apps/plugin-fs";
import { clearYtDlpCache } from "@/lib/commands";
import { MotionButton } from "@/components/motion/MotionButton";
import { SponsorBlockControls } from "@/components/SponsorBlockControls";
import type { SponsorBlockCategoryId } from "@/lib/sponsorblock";
import type { InstagramEngine, SponsorBlockMode } from "@/store/settings";
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
  cookiesFilePath: string;
  onCookiesFilePathChange: (val: string) => void;
  sponsorBlockMode: SponsorBlockMode;
  onSponsorBlockModeChange: (val: SponsorBlockMode) => void;
  sponsorBlockCategories: SponsorBlockCategoryId[];
  onSponsorBlockCategoriesChange: (val: SponsorBlockCategoryId[]) => void;
  instagramEngine: InstagramEngine;
  onInstagramEngineChange: (val: InstagramEngine) => void;
}

export function EngineSection({
  maxConcurrency, onMaxConcurrencyChange,
  maxRetries, onMaxRetriesChange,
  maxSpeed, onMaxSpeedChange,
  cookiesFilePath, onCookiesFilePathChange,
  sponsorBlockMode, onSponsorBlockModeChange,
  sponsorBlockCategories, onSponsorBlockCategoriesChange,
  instagramEngine, onInstagramEngineChange,
}: EngineSectionProps) {
  const [speedUnit, setSpeedUnit] = useState<number>(1);
  const [localSpeedValue, setLocalSpeedValue] = useState<number>(0);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cookiesFileMissing, setCookiesFileMissing] = useState(false);

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

  useEffect(() => {
    const path = cookiesFilePath?.trim() || "";
    let cancelled = false;
    if (!path) {
      const resetTimer = window.setTimeout(() => {
        if (!cancelled) setCookiesFileMissing(false);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(resetTimer);
      };
    }
    void exists(path)
      .then((ok) => {
        if (!cancelled) setCookiesFileMissing(!ok);
      })
      .catch(() => {
        if (!cancelled) setCookiesFileMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cookiesFilePath]);

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

      <SettingRow
        icon={Cookie}
        label="Cookies file"
        description="Netscape cookies.txt for age-gated, private, or members-only videos. Chrome cannot auto-share cookies anymore — export a cookies.txt with a browser extension, then pick the file here."
        vertical
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              value={cookiesFilePath || ""}
              readOnly
              placeholder="No cookies file selected"
              className="bg-muted/30 border-border/30"
            />
            <MotionButton
              type="button"
              variant="outline"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                const selected = await open({
                  directory: false,
                  multiple: false,
                  filters: [
                    { name: "Cookies", extensions: ["txt"] },
                    { name: "All files", extensions: ["*"] },
                  ],
                });
                if (selected && !Array.isArray(selected)) onCookiesFilePathChange(selected);
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              Browse
            </MotionButton>
            {cookiesFilePath ? (
              <MotionButton
                type="button"
                variant="outline"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCookiesFilePathChange("")}
                aria-label="Clear cookies file"
              >
                <X className="w-4 h-4" />
              </MotionButton>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Used for yt-dlp downloads, link preview, and private playlists. Never paste cookie file contents into GitHub issues.
            {cookiesFilePath ? " Path is active — yt-dlp will receive --cookies." : ""}
          </p>
          {cookiesFileMissing ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              File not found at this path. Browse again after exporting cookies.txt.
            </p>
          ) : null}
        </div>
      </SettingRow>

      <SettingRow
        icon={Images}
        label="Instagram Engine"
        description="DownloadGram is the reliable default. yt-dlp can work on public posts with a modern x64 build (curl_cffi is already inside HalalDL’s managed yt-dlp.exe)."
        vertical
      >
        <Select
          value={instagramEngine}
          onValueChange={(value) => onInstagramEngineChange(value as InstagramEngine)}
        >
          <SelectTrigger className="w-full max-w-sm bg-muted/30 border-border/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="downloadgram">DownloadGram (recommended)</SelectItem>
            <SelectItem value="yt-dlp">yt-dlp</SelectItem>
          </SelectContent>
        </Select>
        {instagramEngine === "yt-dlp" ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Some posts still need a cookies.txt file (above). Prefer DownloadGram if downloads fail or look blocked.
          </p>
        ) : null}
      </SettingRow>

      <SponsorBlockControls
        mode={sponsorBlockMode}
        onModeChange={onSponsorBlockModeChange}
        categories={sponsorBlockCategories}
        onCategoriesChange={onSponsorBlockCategoriesChange}
      />

      <SettingRow
        icon={Trash2}
        label="Clear yt-dlp Cache"
        description="Reset cached extractor/challenge data when sites keep asking to sign in or fail oddly."
        vertical
      >
        <MotionButton
          type="button"
          variant="outline"
          disabled={isClearingCache}
          className="h-10 w-full justify-center gap-2 rounded-xl sm:w-auto"
          onClick={() => {
            void (async () => {
              setIsClearingCache(true);
              try {
                const summary = await clearYtDlpCache();
                toast.success("yt-dlp cache cleared", { description: summary });
              } catch (error) {
                toast.error(
                  `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
                );
              } finally {
                setIsClearingCache(false);
              }
            })();
          }}
        >
          <Trash2 className="h-4 w-4" />
          {isClearingCache ? "Clearing..." : "Clear cache"}
        </MotionButton>
      </SettingRow>
    </SettingsSection>
  );
}
