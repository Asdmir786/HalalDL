
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
  private static DESTINATION_REGEX = /\[download\]\s+(?:Destination:|.*has already been downloaded and merged into)\s+(.*)$/;
  private static MERGER_REGEX = /^\[Merger\] Merging formats into "(.*)"\s*$/;

  parse(line: string): DownloadUpdate | null {
    const update: DownloadUpdate = {};
    let hasUpdate = false;

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

    // Already Downloaded / Merged
    const destMatch = line.match(OutputParser.DESTINATION_REGEX);
    if (destMatch?.[1]) {
      const path = this.cleanPath(destMatch[1]);
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
    const trimmed = this.stripAnsiSimple(raw).trim().replace(/\r/g, "");
    return trimmed.replace(/^file:\/\//i, "").replace(/^"(.*)"$/, "$1");
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
