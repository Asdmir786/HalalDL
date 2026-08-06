import { useState } from "react";
import { Activity, CheckCircle2, Cookie, ShieldAlert, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MotionButton } from "@/components/motion/MotionButton";
import { SettingsSection } from "./SettingsSection";
import { SettingRow } from "./SettingRow";
import { probeReliability, validateCookiesFile } from "@/lib/reliability";
import type { WatchlistDeliveryMode } from "@/lib/library-types";

export function ReliabilityCenter({ cookiesFilePath, deliveryMode, onDeliveryModeChange }: { cookiesFilePath: string; deliveryMode: WatchlistDeliveryMode; onDeliveryModeChange: (value: WatchlistDeliveryMode) => void }) {
  const [url, setUrl] = useState(""); const [result, setResult] = useState<string | null>(null); const [checking, setChecking] = useState(false);
  return <SettingsSection id="reliability" icon={Stethoscope} title="Reliability Center" description="Safe checks and clear recovery steps for downloader issues.">
    <SettingRow icon={Activity} label="Test a media link" description="Runs a no-download metadata probe with HalalDL’s configured downloader." vertical>
      <div className="flex flex-col gap-2 sm:flex-row"><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /><MotionButton disabled={checking || !url.trim()} onClick={() => void (async () => { setChecking(true); const next = await probeReliability(url.trim()); setResult(next.message); if (next.ok) toast.success("Access check passed"); else toast.error("Access check needs attention"); setChecking(false); })()}>{checking ? "Checking…" : "Test link"}</MotionButton></div>{result && <p className="mt-2 text-xs text-muted-foreground">{result}</p>}
    </SettingRow>
    <SettingRow icon={Cookie} label="Cookie file check" description="Only checks the file header. Cookie contents are never displayed, stored here, or sent in diagnostics." vertical>
      <MotionButton variant="outline" disabled={!cookiesFilePath} onClick={() => void validateCookiesFile(cookiesFilePath).then((value) => value.valid ? toast.success(value.message) : toast.error(value.message))}>{cookiesFilePath ? "Validate selected cookies.txt" : "Select a cookies.txt file above"}</MotionButton>
    </SettingRow>
    <SettingRow icon={CheckCircle2} label="Watchlist delivery" description="HalalDL asks once, then follows this preference whenever a source finds new items." vertical>
      <Select value={deliveryMode} onValueChange={(value) => onDeliveryModeChange(value as WatchlistDeliveryMode)}><SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ask">Ask when the first source is enabled</SelectItem><SelectItem value="start">Start automatically</SelectItem><SelectItem value="queue">Queue and notify</SelectItem></SelectContent></Select>
    </SettingRow>
    <SettingRow icon={ShieldAlert} label="Recovery guidance" description="Login-required failures use a user-selected cookies.txt file; HalalDL does not extract browser sessions or embed sign-in pages."><span className="text-xs text-muted-foreground">Update yt-dlp, clear its cache, or use the link test above before changing presets.</span></SettingRow>
  </SettingsSection>;
}
