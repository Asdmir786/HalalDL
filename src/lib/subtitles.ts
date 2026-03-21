export type SubtitleMode = "off" | "on" | "only";
export type SubtitleSourcePolicy = "manual" | "auto" | "manual-then-auto";
export type SubtitleLanguageMode = "all" | "preferred" | "custom";
export type SubtitleFormat = "original" | "srt" | "vtt";
export type SubtitleResolvedSource = "manual" | "auto" | "none";
export type SubtitleStatus = "idle" | "checking" | "available" | "unavailable" | "error";

export interface SubtitlePreferences {
  mode: SubtitleMode;
  sourcePolicy: SubtitleSourcePolicy;
  languageMode: SubtitleLanguageMode;
  languages: string[];
  format: SubtitleFormat;
}

export interface SubtitleAvailability {
  hasManualSubtitles: boolean;
  hasAutoSubtitles: boolean;
  availableSubtitleLanguages: string[];
}

export interface SubtitlePlan {
  requested: boolean;
  subtitleOnly: boolean;
  resolvedSource: SubtitleResolvedSource;
  languages: string[];
  format: SubtitleFormat;
}

export const DEFAULT_PREFERRED_SUBTITLE_LANGUAGES = ["en.*", "en"];

export const DEFAULT_SUBTITLE_PREFERENCES: SubtitlePreferences = {
  mode: "off",
  sourcePolicy: "manual-then-auto",
  languageMode: "preferred",
  languages: DEFAULT_PREFERRED_SUBTITLE_LANGUAGES,
  format: "srt",
};

export function normalizeSubtitlePreferences(
  value?: Partial<SubtitlePreferences> | null
): SubtitlePreferences {
  const next = value ?? {};
  return {
    mode: next.mode ?? DEFAULT_SUBTITLE_PREFERENCES.mode,
    sourcePolicy: next.sourcePolicy ?? DEFAULT_SUBTITLE_PREFERENCES.sourcePolicy,
    languageMode: next.languageMode ?? DEFAULT_SUBTITLE_PREFERENCES.languageMode,
    languages:
      next.languages && next.languages.length > 0
        ? next.languages.filter(Boolean)
        : [...DEFAULT_SUBTITLE_PREFERENCES.languages],
    format: next.format ?? DEFAULT_SUBTITLE_PREFERENCES.format,
  };
}

export function splitSubtitleLanguages(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function subtitleLanguagesToString(languages: string[]): string {
  return languages.join(", ");
}

export function resolveSubtitleLanguages(
  prefs: SubtitlePreferences,
  preferredLanguagesText?: string
): string[] {
  if (prefs.languageMode === "all") return ["all"];
  if (prefs.languageMode === "custom") {
    return prefs.languages.length > 0 ? prefs.languages : ["all"];
  }

  const preferred = splitSubtitleLanguages(
    preferredLanguagesText || DEFAULT_PREFERRED_SUBTITLE_LANGUAGES.join(", ")
  );
  return preferred.length > 0 ? preferred : [...DEFAULT_PREFERRED_SUBTITLE_LANGUAGES];
}

export function buildSubtitleSummary(prefs: SubtitlePreferences): string {
  if (prefs.mode === "off") return "No subtitles";
  if (prefs.mode === "only") return "Subtitles only";
  return "Subtitles if available";
}

export function resolveSubtitlePlan(
  prefs: SubtitlePreferences,
  availability: SubtitleAvailability
): SubtitlePlan {
  if (prefs.mode === "off") {
    return {
      requested: false,
      subtitleOnly: false,
      resolvedSource: "none",
      languages: [],
      format: prefs.format,
    };
  }

  let resolvedSource: SubtitleResolvedSource = "none";

  if (prefs.sourcePolicy === "manual") {
    resolvedSource = availability.hasManualSubtitles ? "manual" : "none";
  } else if (prefs.sourcePolicy === "auto") {
    resolvedSource = availability.hasAutoSubtitles ? "auto" : "none";
  } else if (availability.hasManualSubtitles) {
    resolvedSource = "manual";
  } else if (availability.hasAutoSubtitles) {
    resolvedSource = "auto";
  }

  return {
    requested: true,
    subtitleOnly: prefs.mode === "only",
    resolvedSource,
    languages: availability.availableSubtitleLanguages,
    format: prefs.format,
  };
}

export function buildSubtitleAvailabilityLabel(
  availability: SubtitleAvailability
): string {
  if (availability.hasManualSubtitles) return "Manual subtitles available";
  if (availability.hasAutoSubtitles) return "Auto subtitles only";
  return "No subtitles found";
}
