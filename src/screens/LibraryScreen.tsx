import { useMemo, useState } from "react";
import { Archive, BookOpen, Boxes, FolderArchive, ListPlus, Plus, RefreshCw, Ruler, Trash2 } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { MotionButton } from "@/components/motion/MotionButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLibraryStore } from "@/store/library";
import { useHistoryStore } from "@/store/history";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { checkWatchlist } from "@/lib/watchlists";
import { exportCollectionZip } from "@/lib/commands";
import type { WatchlistFirstRunMode } from "@/lib/library-types";

type Tab = "sources" | "collections" | "rules";
const card = "rounded-2xl border border-border/55 bg-card/70 p-4 shadow-sm dark:border-border/40 dark:bg-card/35";

export function LibraryScreen() {
  const [tab, setTab] = useState<Tab>("sources");
  const { watchlists, collections, rules, addWatchlist, updateWatchlist, removeWatchlist, addCollection, removeCollection, addRule, removeRule } = useLibraryStore();
  const presets = usePresetsStore((state) => state.presets);
  const history = useHistoryStore((state) => state.entries);
  const delivery = useSettingsStore((state) => state.settings.watchlistDeliveryMode);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [firstRun, setFirstRun] = useState<WatchlistFirstRunMode>("ask");
  const [sourceCollectionId, setSourceCollectionId] = useState("");
  const [sourcePresetId, setSourcePresetId] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [ruleDomain, setRuleDomain] = useState("");
  const [ruleCollectionId, setRuleCollectionId] = useState("");
  const [rulePresetId, setRulePresetId] = useState("");

  const collectionStats = useMemo(() => collections.map((collection) => ({
    collection,
    entries: history.filter((entry) => entry.collectionId === collection.id && entry.status === "completed"),
  })), [collections, history]);

  const createWatchlist = () => {
    const url = sourceUrl.trim();
    if (!/^https?:\/\//i.test(url)) return toast.error("Paste a full channel or playlist URL.");
    if (firstRun === "ask") return toast.info("Choose a first-run policy", { description: "Download current backlog or future uploads only." });
    if (delivery === "ask") {
      const start = window.confirm("When this source finds new uploads, should HalalDL start them automatically? Choose Cancel to queue them and notify instead. You can change this in Settings → Reliability.");
      updateSettings({ watchlistDeliveryMode: start ? "start" : "queue" });
    }
    const kind = /playlist|list=/i.test(url) ? "youtube-playlist" : /youtube\.com|youtu\.be/i.test(url) ? "youtube-channel" : "collection";
    addWatchlist({ label: sourceLabel.trim() || "New source", url, kind, enabled: true, intervalHours: 6, maxItemsPerCheck: 25, firstRunMode: firstRun, ...(sourceCollectionId ? { collectionId: sourceCollectionId } : {}), ...(sourcePresetId ? { presetId: sourcePresetId } : {}) });
    setSourceUrl(""); setSourceLabel(""); setFirstRun("ask");
    toast.success("Source saved", { description: "Use Check now to initialize it." });
  };

  const exportZip = async (collectionId: string, name: string) => {
    const files = history.filter((entry) => entry.collectionId === collectionId && entry.status === "completed").flatMap((entry) => entry.outputPaths?.length ? entry.outputPaths : entry.outputPath ? [entry.outputPath] : []);
    if (!files.length) return toast.info("No completed media in this collection.");
    const output = await save({ filters: [{ name: "ZIP", extensions: ["zip"] }], defaultPath: `${name.replace(/[^a-z0-9]+/gi, "-") || "HalalDL-collection"}.zip` });
    if (!output) return;
    const result = await exportCollectionZip(output, files);
    toast.success("Collection ZIP created", { description: `${result.added} file(s) added${result.skipped.length ? `; ${result.skipped.length} skipped` : ""}.` });
  };

  return <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 md:px-8">
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <header className="flex flex-col gap-4 rounded-3xl border border-border/55 bg-[linear-gradient(135deg,rgba(248,250,252,.98),rgba(241,245,249,.96))] p-5 shadow-[0_24px_70px_rgba(15,23,42,.08)] dark:border-border/40 dark:bg-[linear-gradient(135deg,rgba(17,24,39,.72),rgba(10,15,27,.94))] md:flex-row md:items-center md:justify-between">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.2em] text-primary"><BookOpen className="h-3.5 w-3.5" /> Local library</div><h2 className="text-3xl font-bold tracking-tight">Sources, collections, and rules</h2><p className="mt-1 text-sm text-muted-foreground">Everything stays on this Windows device. Watchlists run while HalalDL is in the tray.</p></div>
        <div className="inline-flex rounded-xl border border-border/60 bg-background/70 p-1">{(["sources", "collections", "rules"] as Tab[]).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${tab === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{item}</button>)}</div>
      </header>

      {tab === "sources" && <section className="space-y-4"><div className={card}><div className="mb-3 flex items-center gap-2 font-semibold"><ListPlus className="h-4 w-4 text-primary" /> Add a source</div><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} placeholder="Friendly name (optional)" /><Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="YouTube channel or playlist URL" /><MotionButton onClick={createWatchlist}><Plus className="mr-2 h-4 w-4" />Add source</MotionButton></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>First run:</span><Select value={firstRun} onValueChange={(value) => setFirstRun(value as WatchlistFirstRunMode)}><SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ask">Choose before enabling</SelectItem><SelectItem value="backlog">Download current backlog</SelectItem><SelectItem value="future-only">Future uploads only</SelectItem></SelectContent></Select><span>Delivery preference: {delivery === "ask" ? "not set" : delivery === "start" ? "start automatically" : "queue and notify"}.</span></div></div>
        <div className="mt-3 grid gap-2 md:grid-cols-2"><Select value={sourceCollectionId || "none"} onValueChange={(value) => setSourceCollectionId(value === "none" ? "" : value)}><SelectTrigger className="h-8"><SelectValue placeholder="Collection (optional)" /></SelectTrigger><SelectContent><SelectItem value="none">No collection</SelectItem>{collections.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={sourcePresetId || "none"} onValueChange={(value) => setSourcePresetId(value === "none" ? "" : value)}><SelectTrigger className="h-8"><SelectValue placeholder="Preset (optional)" /></SelectTrigger><SelectContent><SelectItem value="none">Default preset</SelectItem>{presets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        {watchlists.length === 0 ? <Empty text="Add a channel or playlist to begin building a private local library." /> : watchlists.map((watchlist) => <div key={watchlist.id} className={card}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="font-semibold">{watchlist.label}</div><div className="mt-1 break-all text-xs text-muted-foreground">{watchlist.url}</div><div className="mt-2 text-xs text-muted-foreground">Every {watchlist.intervalHours}h · {watchlist.maxItemsPerCheck} item batch · {collections.find((item) => item.id === watchlist.collectionId)?.name || "No collection"} · {watchlist.lastSuccessAt ? `checked ${new Date(watchlist.lastSuccessAt).toLocaleString()}` : "not initialized"}{watchlist.lastError ? ` · ${watchlist.lastError}` : ""}</div></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => updateWatchlist(watchlist.id, { enabled: !watchlist.enabled })}>{watchlist.enabled ? "Pause" : "Resume"}</Button><Button variant="outline" size="sm" onClick={() => void checkWatchlist(watchlist, true).then((count) => toast.success("Source checked", { description: `${count} new item(s) added.` }))}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Check now</Button><Button variant="ghost" size="icon" onClick={() => removeWatchlist(watchlist.id)} aria-label="Delete source"><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></div>)}</section>}

      {tab === "collections" && <section className="space-y-4"><div className={card}><div className="mb-3 flex items-center gap-2 font-semibold"><Boxes className="h-4 w-4 text-primary" /> Create a media collection</div><div className="flex gap-2"><Input value={newCollection} onChange={(event) => setNewCollection(event.target.value)} placeholder="e.g. Friday lectures" /><MotionButton onClick={() => { if (!newCollection.trim()) return; addCollection({ name: newCollection.trim(), tags: [] }); setNewCollection(""); }}><Plus className="mr-2 h-4 w-4" />Create</MotionButton></div></div>{collectionStats.length === 0 ? <Empty text="Collections let rules and sources organize media into one local place." /> : collectionStats.map(({ collection, entries }) => <div key={collection.id} className={card}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="font-semibold">{collection.name}</div><div className="mt-1 text-sm text-muted-foreground">{entries.length} completed item(s) · {collection.folder || "Default download folder"}</div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => void exportZip(collection.id, collection.name)}><FolderArchive className="mr-1.5 h-3.5 w-3.5" />Export ZIP</Button><Button variant="ghost" size="icon" onClick={() => removeCollection(collection.id)} aria-label="Delete collection"><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div></div>)}</section>}

      {tab === "rules" && <section className="space-y-4"><div className={card}><div className="mb-2 flex items-center gap-2 font-semibold"><Ruler className="h-4 w-4 text-primary" /> Add a domain rule</div><div className="flex gap-2"><Input value={ruleDomain} onChange={(event) => setRuleDomain(event.target.value)} placeholder="youtube.com" /><MotionButton onClick={() => { const domain = ruleDomain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""); if (!domain) return; addRule({ name: `From ${domain}`, enabled: true, match: { type: "domain", value: domain }, ...(ruleCollectionId ? { collectionId: ruleCollectionId } : {}), ...(rulePresetId ? { presetId: rulePresetId } : {}) }); setRuleDomain(""); }}><Plus className="mr-2 h-4 w-4" />Add rule</MotionButton></div><div className="mt-3 grid gap-2 md:grid-cols-2"><Select value={ruleCollectionId || "none"} onValueChange={(value) => setRuleCollectionId(value === "none" ? "" : value)}><SelectTrigger className="h-8"><SelectValue placeholder="Collection" /></SelectTrigger><SelectContent><SelectItem value="none">No collection</SelectItem>{collections.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Select value={rulePresetId || "none"} onValueChange={(value) => setRulePresetId(value === "none" ? "" : value)}><SelectTrigger className="h-8"><SelectValue placeholder="Preset" /></SelectTrigger><SelectContent><SelectItem value="none">Default preset</SelectItem>{presets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div><p className="mt-2 text-xs text-muted-foreground">Specific creator or playlist rules win over Watchlist rules; Watchlist rules win over general domains.</p></div>{rules.length === 0 ? <Empty text="Rules automatically apply a collection, folder, preset, tags, and chapter preference to matching downloads." /> : rules.sort((a, b) => a.priority - b.priority).map((rule) => <div key={rule.id} className={card}><div className="flex items-center justify-between gap-3"><div><div className="font-semibold">{rule.name}</div><div className="mt-1 text-sm text-muted-foreground">When {rule.match.type} is <code className="rounded bg-muted px-1">{rule.match.value}</code>, use {collections.find((item) => item.id === rule.collectionId)?.name || "default collection"} and {presets.find((item) => item.id === rule.presetId)?.name || "default preset"}.</div></div><Button variant="ghost" size="icon" onClick={() => removeRule(rule.id)} aria-label="Delete rule"><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</section>}
    </div>
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-border/70 px-6 py-12 text-center text-sm text-muted-foreground"><Archive className="mx-auto mb-3 h-7 w-7 opacity-50" />{text}</div>; }
