export interface DownloadUpdate {
  progress?: number;
  speed?: string;
  eta?: string;
  totalSize?: string;
  title?: string;
  outputPath?: string;
  status?: "Post-processing" | "Downloading";
}

export class OutputParser {
  private static PROGRESS_REGEX = /\[download\]\s+(\d+\.\d+)%/;
  private static SPEED_REGEX = /at\s+([\d.]+\w+\/s)/;
  private static ETA_REGEX = /ETA\s+(\d+:\d+)/;
  private static TOTAL_SIZE_REGEX = /\bof\s+~?([\d.]+)\s*([KMGT]?iB|B)\b/i;
  private static DESTINATION_REGEX =
    /\[download\]\s+(?:Destination:|.*has already been downloaded(?: and merged into)?)\s+(.*)$/;
  private static ALREADY_DOWNLOADED_REGEX =
    /\[download\]\s+(.*?)\s+has already been downloaded$/;
  private static MERGER_REGEX = /^\[Merger\] Merging formats into "(.*)"\s*$/;
  private static GENERIC_DESTINATION_REGEX =
    /^\[[^\]]+\]\s+Destination:\s+(.*)$/;
  private static HALALDL_OUTPUT_REGEX = /^__HALALDL_OUTPUT__:(.*)$/;
  private static HALALDL_SIZE_REGEX = /^__HALALDL_SIZE__:(.*)$/;

  parse(line: string): DownloadUpdate | null {
    const update: DownloadUpdate = {};
    let hasUpdate = false;

    const halalDlOutputMatch = line.match(OutputParser.HALALDL_OUTPUT_REGEX);
    if (halalDlOutputMatch?.[1]) {
      const path = this.cleanPath(halalDlOutputMatch[1]);
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    const halalDlSizeMatch = line.match(OutputParser.HALALDL_SIZE_REGEX);
    if (halalDlSizeMatch?.[1]) {
      const raw = this.stripAnsiSimple(halalDlSizeMatch[1]).trim();
      const bytes = Number.parseInt(raw, 10);
      if (Number.isFinite(bytes) && bytes > 0) {
        update.totalSize = this.formatBytes(bytes);
        hasUpdate = true;
      }
    }

    // Progress
    const progressMatch = line.match(OutputParser.PROGRESS_REGEX);
    if (progressMatch) {
      update.progress = parseFloat(progressMatch[1]);
      hasUpdate = true;
    }

    // Speed
    const speedMatch = line.match(OutputParser.SPEED_REGEX);
    if (speedMatch) {
      update.speed = speedMatch[1];
      hasUpdate = true;
    }

    // ETA
    const etaMatch = line.match(OutputParser.ETA_REGEX);
    if (etaMatch) {
      update.eta = etaMatch[1];
      hasUpdate = true;
    }

    const totalSizeMatch = line.match(OutputParser.TOTAL_SIZE_REGEX);
    if (totalSizeMatch) {
      update.totalSize = `${totalSizeMatch[1]}${totalSizeMatch[2]}`;
      hasUpdate = true;
    }

    // Destination / Title
    // Standard Destination
    if (line.startsWith("[download] Destination:")) {
      const path = this.cleanPath(line.replace("[download] Destination:", ""));
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    // Non-download Destination (ExtractAudio/ffmpeg/etc)
    const genericDestMatch = line.match(OutputParser.GENERIC_DESTINATION_REGEX);
    if (genericDestMatch?.[1]) {
      const path = this.cleanPath(genericDestMatch[1]);
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    // Already Downloaded / Merged
    const destMatch = line.match(OutputParser.DESTINATION_REGEX);
    if (destMatch?.[1]) {
      const path = this.cleanPath(destMatch[1]);
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    // Explicit "has already been downloaded"
    const alreadyMatch = line.match(OutputParser.ALREADY_DOWNLOADED_REGEX);
    if (alreadyMatch?.[1]) {
      const path = this.cleanPath(alreadyMatch[1]);
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    // Merger
    const mergerMatch = line.match(OutputParser.MERGER_REGEX);
    if (mergerMatch?.[1]) {
      const path = this.cleanPath(mergerMatch[1]);
      update.outputPath = path;
      update.title = this.extractTitle(path);
      update.status = "Post-processing";
      hasUpdate = true;
    }

    // Post-processing generic detection
    if (line.startsWith("[ffmpeg]") || line.startsWith("[VideoConvertor]")) {
      update.status = "Post-processing";
      hasUpdate = true;
    }

    return hasUpdate ? update : null;
  }

  private cleanPath(raw: string): string {
    let trimmed = this.stripAnsiSimple(raw)
      .trim()
      .replace(/[\r\n]/g, "");
    trimmed = trimmed.replace(/^"(.*)"$/, "$1");
    trimmed = this.stripFileUriPrefix(trimmed);
    return trimmed;
  }

  private stripFileUriPrefix(path: string): string {
    const lower = path.toLowerCase();
    if (!lower.startsWith("file:")) return path;

    let out = path.replace(/^file:\/\//i, "").replace(/^file:\//i, "");
    out = out.replace(/^localhost\//i, "");
    if (/^\/[a-zA-Z]:\//.test(out)) out = out.slice(1);

    try {
      out = decodeURIComponent(out);
    } catch {
      void 0;
    }

    return out;
  }

  private stripAnsiSimple(input: string): string {
    let out = "";
    for (let i = 0; i < input.length; i++) {
      if (input.charCodeAt(i) === 27 && input[i + 1] === "[") {
        i += 2;
        while (i < input.length && input[i] !== "m") i++;
        continue;
      }
      out += input[i];
    }
    return out;
  }

  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)}${units[unitIndex]}`;
  }

  private extractTitle(path: string): string {
    return path.split(/[\\/]/).pop() || path;
  }
}
