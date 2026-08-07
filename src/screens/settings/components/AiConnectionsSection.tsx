import { useState } from "react";
import { KeyRound, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_PROVIDERS, type AiProvider, useAiProfilesStore } from "@/lib/ai-profiles";
import { removeAiApiKey, saveAiApiKey } from "@/lib/commands";
import { SettingsSection } from "./SettingsSection";

export function AiConnectionsSection() {
  const { profiles, add, markSaved, remove } = useAiProfilesStore();
  const [open, setOpen] = useState(false); const [provider, setProvider] = useState<AiProvider>("elevenlabs"); const [label, setLabel] = useState(""); const [key, setKey] = useState("");
  const save = async () => { if (!key.trim()) return toast.error("Paste an API key or close this panel without saving one."); const id = add(provider, label); try { await saveAiApiKey(id, key.trim()); markSaved(id, true); setLabel(""); setKey(""); toast.success("API key saved securely"); } catch (error) { remove(id); toast.error(error instanceof Error ? error.message : "Could not save the key securely."); } };
  const erase = async (id: string) => { try { await removeAiApiKey(id); } catch { /* local profile can still be removed when the credential is already gone */ } remove(id); };
  return <SettingsSection id="ai" icon={Sparkles} title="AI connections" description="Optional. Add a provider only when you want to use an AI feature such as transcript or translation.">
    <p className="text-sm text-muted-foreground">Keys are stored in Windows Credential Manager. They are not saved in HalalDL settings, backups, or diagnostics.</p>
    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-sm font-medium">Provider profiles</span><Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />Add provider</Button></div>
    {profiles.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No provider has been added. When an AI action is ready, HalalDL will bring you here.</p> : <div className="mt-2 divide-y divide-border/60">{profiles.map((profile) => <div key={profile.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{profile.label}</p><p className="text-xs text-muted-foreground">{AI_PROVIDERS.find((item) => item.id === profile.provider)?.name} · saved securely on this PC</p></div><Button variant="ghost" size="icon" onClick={() => void erase(profile.id)} aria-label={`Remove ${profile.label}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}
    {open && <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-primary" /> Add a provider key</p><p className="mt-1 text-xs text-muted-foreground">Keep this open while you add as many providers as you want.</p></div><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><Select value={provider} onValueChange={(value) => setProvider(value as AiProvider)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AI_PROVIDERS.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} — {item.uses}</SelectItem>)}</SelectContent></Select><Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Profile name, for example Personal" /></div><Input className="mt-2" value={key} onChange={(event) => setKey(event.target.value)} type="password" autoComplete="off" placeholder="API key" /><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void save()}>Save securely on this PC</Button><Button size="sm" variant="outline" onClick={() => { setKey(""); setLabel(""); }}>Add another key</Button></div></div>}
  </SettingsSection>;
}
