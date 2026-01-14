import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

async function getToolPath(baseName: string): Promise<string> {
  try {
    const dataDir = await appDataDir();
    const localPath = await join(dataDir, "bin", `${baseName}.exe`);
    if (await exists(localPath)) {
      return localPath;
    }
  } catch {
    // Ignore and fallback
  }
  return baseName;
}

export async function startDownload(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const { presets } = usePresetsStore.getState();
  const { settings } = useSettingsStore.getState();

  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  const preset = presets.find((p) => p.id === job.presetId) || presets[0];
  const ytDlpPath = await getToolPath("yt-dlp");
  const ffmpegPath = await getToolPath("ffmpeg");
  const aria2Path = await getToolPath("aria2c");

  const args = [...preset.args];

  // Apply Format Override if present
  if (job.overrides?.format) {
    // Remove existing format args if any
    const formatIndex = args.indexOf("-f");
    if (formatIndex !== -1) {
        args.splice(formatIndex, 2);
    }
    
    switch (job.overrides.format) {
        case "best":
            args.push("-f", "bestvideo+bestaudio/best");
            break;
        case "mp4":
            args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
            break;
        case "mp3":
            args.push("-x", "--audio-format", "mp3");
            break;
        case "mkv":
            args.push("--merge-output-format", "mkv");
            break;
        default:
            // Custom format string
            args.push("-f", job.overrides.format);
    }
  }

  // Add ffmpeg path if it exists
  if (ffmpegPath !== "ffmpeg") {
    const ffmpegDir = ffmpegPath.replace(/\\ffmpeg\.exe$/, "");
    args.push("--ffmpeg-location", ffmpegDir);
  }

  // Use aria2 if available
  if (aria2Path !== "aria2c") {
    addLog({ level: "info", message: `Using local aria2c: ${aria2Path}`, jobId });
    // Use the absolute path for both the executable and the downloader name
    args.push("--external-downloader", aria2Path);
    // Remove the aria2c: prefix to ensure args are applied regardless of how yt-dlp identifies the binary
    args.push("--external-downloader-args", "-x 16 -s 16 -k 1M --summary-interval=0");
  } else {
    // Check if aria2c is in system path
    addLog({ level: "info", message: "Aria2c not found in local bin, checking system PATH...", jobId });
  }

  // Add output template
  const downloadDir = job.overrides?.downloadDir || settings.defaultDownloadDir;
  const filenameTemplate = job.overrides?.filenameTemplate || "%(title)s.%(ext)s";

  if (downloadDir) {
    args.push("-o", await join(downloadDir, filenameTemplate));
  } else {
    // If no dir set, just use template (current working dir)
    args.push("-o", filenameTemplate);
  }

  // Ensure consistent behavior: ignore global config and force newline output for logs
  args.push("--ignore-config", "--newline", "--no-playlist");

  args.push(job.url);

  const quotedArgs = args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(" ");
  addLog({ level: "info", message: `Executing Command:\n${ytDlpPath} ${quotedArgs}`, jobId });
  updateJob(jobId, { status: "Downloading", progress: 0 });

  try {
    const cmd = Command.create(ytDlpPath, args);

    cmd.on("close", (data) => {
      addLog({ level: "info", message: `Process finished with code ${data.code}`, jobId });
      if (data.code === 0) {
        updateJob(jobId, { status: "Done", progress: 100 });
      } else {
        updateJob(jobId, { status: "Failed" });
      }
    });

    cmd.on("error", (error) => {
      addLog({ level: "error", message: `Process error: ${error}`, jobId });
      updateJob(jobId, { status: "Failed" });
    });

    cmd.stdout.on("data", (line) => {
      addLog({ level: "info", message: line, jobId });
      
      // Parse progress: [download]  12.3% of 45.67MiB at 8.90MiB/s ETA 00:01
      const progressMatch = line.match(/\[download\]\s+(\d+\.\d+)%/);
      if (progressMatch) {
        const progress = parseFloat(progressMatch[1]);
        updateJob(jobId, { progress });
      }

      const speedMatch = line.match(/at\s+([\d.]+\w+\/s)/);
      if (speedMatch) {
        updateJob(jobId, { speed: speedMatch[1] });
      }

      const etaMatch = line.match(/ETA\s+(\d+:\d+)/);
      if (etaMatch) {
        updateJob(jobId, { eta: etaMatch[1] });
      }

      // Title detection
      if (line.startsWith("[download] Destination:")) {
        const path = line.replace("[download] Destination:", "").trim();
        const title = path.split(/[\\/]/).pop() || path;
        updateJob(jobId, { title, outputPath: path });
      }

      const mergerMatch = line.match(/^\[Merger\] Merging formats into "(.*)"\s*$/);
      if (mergerMatch?.[1]) {
        const path = mergerMatch[1].trim();
        const title = path.split(/[\\/]/).pop() || path;
        updateJob(jobId, { title, outputPath: path, status: "Post-processing" });
      }

      // Post-processing detection
      if (line.startsWith("[ffmpeg]") || line.startsWith("[VideoConvertor]")) {
        updateJob(jobId, { status: "Post-processing" });
      }
    });

    cmd.stderr.on("data", (line) => {
      addLog({ level: "error", message: `STDERR: ${line}`, jobId });
      
      // Some aria2 errors might come through stderr
      if (line.includes("aria2c") || line.includes("downloader")) {
        // Log it as an error but keep status as Failed (compatible with JobStatus type)
        addLog({ level: "error", message: "Downloader specific error detected", jobId });
        updateJob(jobId, { status: "Failed" });
      }
    });

    await cmd.spawn();
  } catch (e) {
    addLog({ level: "error", message: `Failed to spawn process: ${e}`, jobId });
    updateJob(jobId, { status: "Failed" });
  }
}
