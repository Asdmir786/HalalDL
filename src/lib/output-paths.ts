import { convertFileSrc } from "@tauri-apps/api/core";

type OutputPathLike = {
  outputPath?: string;
  outputPaths?: string[];
};

type ThumbnailSourceLike = OutputPathLike & {
  thumbnail?: string;
  thumbnailSheet?: string;
};

const IMAGE_FILE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "avif",
]);

export function getExplicitOutputPaths(value: OutputPathLike): string[] {
  const paths = value.outputPaths?.length ? value.outputPaths : value.outputPath ? [value.outputPath] : [];
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const path of paths) {
    const trimmed = path?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    deduped.push(trimmed);
  }

  return deduped;
}

function getExtension(path: string): string {
  const cleanPath = path.split("?")[0]?.split("#")[0] ?? "";
  const match = cleanPath.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function isImageFilePath(path: string): boolean {
  return IMAGE_FILE_EXTENSIONS.has(getExtension(path));
}

function toLocalAssetUrl(path: string): string | undefined {
  try {
    return convertFileSrc(path);
  } catch {
    return undefined;
  }
}

export function getPreferredThumbnailSource(value: ThumbnailSourceLike): string | undefined {
  const localImagePath = getExplicitOutputPaths(value).find(isImageFilePath);
  if (localImagePath) {
    return toLocalAssetUrl(localImagePath) ?? value.thumbnail;
  }

  return value.thumbnail;
}

export function ensureFilenameTemplateExtension(template: string): string {
  const trimmed = template.trim();
  if (!trimmed || /%\(ext\)s/i.test(trimmed)) return trimmed;
  return `${trimmed}.%(ext)s`;
}
