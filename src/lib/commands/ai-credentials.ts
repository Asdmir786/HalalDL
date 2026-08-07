import { invoke } from "@tauri-apps/api/core";
export const saveAiApiKey = (profileId: string, apiKey: string) => invoke<void>("save_ai_api_key", { profileId, apiKey });
export const hasAiApiKey = (profileId: string) => invoke<boolean>("has_ai_api_key", { profileId });
export const removeAiApiKey = (profileId: string) => invoke<void>("remove_ai_api_key", { profileId });
