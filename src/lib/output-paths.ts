type OutputPathLike = {
  outputPath?: string;
  outputPaths?: string[];
};

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
