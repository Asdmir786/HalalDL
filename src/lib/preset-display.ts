import {
  buildSubtitleSummary,
  normalizeSubtitlePreferences,
  type SubtitleFormat,
  type SubtitleLanguageMode,
  type SubtitleMode,
  type SubtitleSourcePolicy,
} from "@/lib/subtitles";
import type { Preset, PresetGroup } from "@/store/presets";

export const PRESET_GROUP_ORDER: PresetGroup[] = [
  "recommended",
  "share",
  "audio",
  "subtitles",
  "formats",
  "editing",
  "custom",
];

export const PRESET_GROUP_LABELS: Record<PresetGroup, string> = {
  recommended: "Recommended",
  share: "Share",
  audio: "Audio",
  subtitles: "Subtitles",
  formats: "Formats",
  editing: "Editing",
  custom: "My Presets",
};

export const PRESET_ID_ALIASES: Record<string, string> = {
  "editors-premiere-ae-1080p-mp4": "editors-capcut-1080p-mp4",
  "editors-premiere-ae-4k-mp4": "editors-capcut-4k-mp4",
};

const FEATURED_FALLBACK_IDS = ["default", "default-subs", "whatsapp-optimized", "mp3", "subtitles-only"] as const;

export function canonicalizePresetId(presetId?: string | null): string {
  if (!presetId) return "default";
  return PRESET_ID_ALIASES[presetId] ?? presetId;
}

export function getPresetGroup(preset: Preset): PresetGroup {
  if (preset.group) return preset.group;
  return preset.isBuiltIn ? "recommended" : "custom";
}

export function resolvePresetById(presets: Preset[], presetId?: string | null): Preset | undefined {
  const canonicalId = canonicalizePresetId(presetId);
  return presets.find((preset) => preset.id === canonicalId)
    ?? presets.find((preset) => preset.id === presetId)
    ?? presets[0];
}

export function resolveExistingPresetId(presets: Preset[], presetId?: string | null, fallback = "default"): string {
  return resolvePresetById(presets, presetId)?.id ?? fallback;
}

export function sortPresetsForDisplay(presets: Preset[]): Preset[] {
  return [...presets].sort((left, right) => {
    const groupOrderDiff = PRESET_GROUP_ORDER.indexOf(getPresetGroup(left)) - PRESET_GROUP_ORDER.indexOf(getPresetGroup(right));
    if (groupOrderDiff !== 0) return groupOrderDiff;

    if ((left.featured ?? false) !== (right.featured ?? false)) {
      return left.featured ? -1 : 1;
    }

    if (left.isBuiltIn !== right.isBuiltIn) {
      return left.isBuiltIn ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getQuickEligiblePresets(presets: Preset[]): Preset[] {
  return sortPresetsForDisplay(presets.filter((preset) => preset.quickEligible !== false));
}

export function getFeaturedPresets(presets: Preset[]): Preset[] {
  const quickPresets = getQuickEligiblePresets(presets);
  const preferred = quickPresets.filter((preset) => preset.featured);
  if (preferred.length > 0) return preferred;

  const byId = new Map(quickPresets.map((preset) => [preset.id, preset]));
  return FEATURED_FALLBACK_IDS
    .map((id) => byId.get(id))
    .filter((preset): preset is Preset => Boolean(preset));
}

export function getPresetSubtitleState(preset: Preset): {
  mode: SubtitleMode;
  sourcePolicy: SubtitleSourcePolicy;
  languageMode: SubtitleLanguageMode;
  format: SubtitleFormat;
} {
  const normalized = normalizeSubtitlePreferences({
    mode: preset.subtitleOnly ? "only" : preset.subtitleMode,
    sourcePolicy: preset.subtitleSourcePolicy,
    languageMode: preset.subtitleLanguageMode,
    languages: preset.subtitleLanguages,
    format: preset.subtitleFormat,
  });

  return {
    mode: normalized.mode,
    sourcePolicy: normalized.sourcePolicy,
    languageMode: normalized.languageMode,
    format: normalized.format,
  };
}

export function getPresetSubtitleDetail(preset: Preset): string {
  const subtitleState = getPresetSubtitleState(preset);
  const subtitleSummary = buildSubtitleSummary({
    ...normalizeSubtitlePreferences({
      mode: subtitleState.mode,
      sourcePolicy: subtitleState.sourcePolicy,
      languageMode: subtitleState.languageMode,
      languages: preset.subtitleLanguages,
      format: subtitleState.format,
    }),
  });

  if (subtitleState.mode === "off") return "No subtitles";
  if (subtitleState.mode === "only") {
    return subtitleState.sourcePolicy === "auto"
      ? "Downloads auto-generated subtitles only"
      : subtitleState.sourcePolicy === "manual"
        ? "Downloads manual subtitles only"
        : "Downloads manual subtitles first, then auto-generated captions";
  }

  if (subtitleSummary === "Subtitles if available") {
    if (subtitleState.sourcePolicy === "manual") return "Manual subtitles when available";
    if (subtitleState.sourcePolicy === "auto") return "Auto-generated subtitles when available";
    return "Manual subtitles first, then auto-generated captions";
  }

  return subtitleSummary;
}

export function groupPresetsForSelect(presets: Preset[]): Array<{ group: PresetGroup; label: string; presets: Preset[] }> {
  const grouped = new Map<PresetGroup, Preset[]>();
  for (const preset of sortPresetsForDisplay(presets)) {
    const group = getPresetGroup(preset);
    const current = grouped.get(group) ?? [];
    current.push(preset);
    grouped.set(group, current);
  }

  return PRESET_GROUP_ORDER
    .map((group) => ({
      group,
      label: PRESET_GROUP_LABELS[group],
      presets: grouped.get(group) ?? [],
    }))
    .filter((entry) => entry.presets.length > 0);
}
