import type { SponsorBlockMode } from "@/store/settings";

export type SponsorBlockCategoryId =
  | "sponsor"
  | "intro"
  | "outro"
  | "selfpromo"
  | "interaction"
  | "preview"
  | "filler"
  | "music_offtopic"
  | "hook";

export const SPONSORBLOCK_CATEGORY_OPTIONS: ReadonlyArray<{
  id: SponsorBlockCategoryId;
  label: string;
  description: string;
}> = [
  { id: "sponsor", label: "Sponsor", description: "Paid promotions" },
  { id: "selfpromo", label: "Self promo", description: "Unpaid self-promotion" },
  { id: "interaction", label: "Interaction", description: "Like / subscribe reminders" },
  { id: "intro", label: "Intro", description: "Opening animation / pause" },
  { id: "outro", label: "Outro", description: "End screens / credits" },
  { id: "preview", label: "Preview", description: "Recap / preview clips" },
  { id: "filler", label: "Filler", description: "Tangents / non-essential" },
  { id: "music_offtopic", label: "Non-music", description: "Off-topic in music videos" },
  { id: "hook", label: "Hook", description: "Unrelated attention grabber" },
];

export const DEFAULT_SPONSORBLOCK_CATEGORIES: SponsorBlockCategoryId[] = [
  "sponsor",
  "intro",
  "outro",
  "selfpromo",
  "interaction",
];

const CATEGORY_ID_SET = new Set<string>(SPONSORBLOCK_CATEGORY_OPTIONS.map((option) => option.id));

export function normalizeSponsorBlockCategories(
  value: unknown
): SponsorBlockCategoryId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SPONSORBLOCK_CATEGORIES];
  }

  const normalized = value
    .map((entry) => String(entry).trim().toLowerCase())
    .filter((entry): entry is SponsorBlockCategoryId => CATEGORY_ID_SET.has(entry));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...DEFAULT_SPONSORBLOCK_CATEGORIES];
}

export function formatSponsorBlockCategories(
  categories: readonly SponsorBlockCategoryId[]
): string {
  const normalized = normalizeSponsorBlockCategories(categories);
  return normalized.join(",");
}

export function sponsorBlockModeLabel(mode: SponsorBlockMode): string {
  if (mode === "mark") return "Mark as chapters";
  if (mode === "remove") return "Remove segments";
  return "Off";
}
