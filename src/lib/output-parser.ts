
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
      const path = line.replace("[download] Destination:", "").trim();
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    // Already Downloaded / Merged
    const destMatch = line.match(OutputParser.DESTINATION_REGEX);
    if (destMatch?.[1]) {
      const path = destMatch[1].trim();
      update.outputPath = path;
      update.title = this.extractTitle(path);
      hasUpdate = true;
    }

    // Merger
    const mergerMatch = line.match(OutputParser.MERGER_REGEX);
    if (mergerMatch?.[1]) {
      const path = mergerMatch[1].trim();
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

  private extractTitle(path: string): string {
    return path.split(/[\\/]/).pop() || path;
  }
}
