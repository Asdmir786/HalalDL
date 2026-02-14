
export interface DownloadUpdate {
  progress?: number;
  speed?: string;
  eta?: string;
  title?: string;
  outputPath?: string;
  status?: "Post-processing" | "Downloading";
}

export class OutputParser {
  private static PROGRESS_REGEX = /\[download\]\s+(\d+\.\d+)%/;
  private static SPEED_REGEX = /at\s+([\d.]+\w+\/s)/;
  private static ETA_REGEX = /ETA\s+(\d+:\d+)/;
  private static DESTINATION_REGEX = /\[download\]\s+(?:Destination:|.*has already been downloaded(?: and merged into)?)\s+(.*)$/;
  private static ALREADY_DOWNLOADED_REGEX = /\[download\]\s+(.*?)\s+has already been downloaded$/;
  private static MERGER_REGEX = /^\[Merger\] Merging formats into "(.*)"\s*$/;
  private static GENERIC_DESTINATION_REGEX = /^\[[^\]]+\]\s+Destination:\s+(.*)$/;
  private static HALALDL_OUTPUT_MARKER = "__HALALDL_OUTPUT__:";

  parse(line: string): DownloadUpdate | null {
    const update: DownloadUpdate = {};
    let hasUpdate = false;

    const markerIndex = line.indexOf(OutputParser.HALALDL_OUTPUT_MARKER);
    if (markerIndex !== -1) {
      const rawPath = line.slice(markerIndex + OutputParser.HALALDL_OUTPUT_MARKER.length);
      const path = this.cleanPath(rawPath);
      if (path) {
        update.outputPath = path;
        update.title = this.extractTitle(path);
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
    let trimmed = this.stripAnsiSimple(raw).trim().replace(/[\r\n]/g, "");
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

  private extractTitle(path: string): string {
    return path.split(/[\\/]/).pop() || path;
  }
}
