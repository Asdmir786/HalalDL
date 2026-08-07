import { create } from "zustand";
import { createId } from "@/lib/id";

export type AiProvider = "elevenlabs" | "openai" | "gemini" | "anthropic" | "xai" | "deepseek" | "qwen" | "glm" | "kimi" | "custom";
export interface AiProfile { id: string; provider: AiProvider; label: string; createdAt: number; hasSecureKey: boolean; }
export const AI_PROVIDERS: { id: AiProvider; name: string; short: string; uses: string }[] = [
  { id: "elevenlabs", name: "ElevenLabs", short: "11", uses: "Transcript" }, { id: "openai", name: "OpenAI", short: "O", uses: "Notes, translate, images" }, { id: "gemini", name: "Google Gemini", short: "G", uses: "Notes, translate, images" }, { id: "anthropic", name: "Anthropic", short: "A", uses: "Notes, translate, images" }, { id: "xai", name: "Grok", short: "x", uses: "Notes, translate, images" }, { id: "deepseek", name: "DeepSeek", short: "D", uses: "Notes, translate" }, { id: "qwen", name: "Qwen", short: "Q", uses: "Notes, translate, images" }, { id: "glm", name: "GLM", short: "Z", uses: "Notes, translate, images" }, { id: "kimi", name: "Kimi", short: "K", uses: "Notes, translate" }, { id: "custom", name: "Custom compatible", short: "C", uses: "Advanced setup" },
];
interface AiState { profiles: AiProfile[]; add: (provider: AiProvider, label: string) => string; markSaved: (id: string, hasSecureKey: boolean) => void; remove: (id: string) => void; }
export const useAiProfilesStore = create<AiState>((set) => ({ profiles: [], add: (provider, label) => { const id = createId(); set((state) => ({ profiles: [...state.profiles, { id, provider, label: label.trim() || AI_PROVIDERS.find((item) => item.id === provider)!.name, createdAt: Date.now(), hasSecureKey: false }] })); return id; }, markSaved: (id, hasSecureKey) => set((state) => ({ profiles: state.profiles.map((item) => item.id === id ? { ...item, hasSecureKey } : item) })), remove: (id) => set((state) => ({ profiles: state.profiles.filter((item) => item.id !== id) })), }));
