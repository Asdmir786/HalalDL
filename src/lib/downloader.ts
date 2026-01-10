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
  const dataDir = await appDataDir();
  const binDir = await join(dataDir, "bin");

  const args = [...preset.args];

  // Add ffmpeg path if it exists
  if (ffmpegPath !== "ffmpeg") {
    const ffmpegDir = ffmpegPath.replace(/\\ffmpeg\.exe$/, "");
    args.push("--ffmpeg-location", ffmpegDir);
  }

  // Use aria2 if available
  if (aria2Path !== "aria2c") {
    args.push("--external-downloader", "aria2c");
    args.push("--external-downloader-args", "aria2c:-x 16 -s 16 -k 1M");
  }

  // Add output template
  const downloadDir = settings.defaultDownloadDir;
  if (downloadDir) {
    args.push("-o", await join(downloadDir, "%(title)s.%(ext)s"));
  }

  args.push(job.url);

  addLog({ level: "info", message: `Starting download: ${ytDlpPath} ${args.join(" ")}`, jobId });
  updateJob(jobId, { status: "Downloading", progress: 0 });

  try {
    // Merge local bin dir into PATH so yt-dlp can find deno, etc.
    const cmd = Command.create(ytDlpPath, args, {
        env: {
            PATH: `${binDir};${process.env.PATH || ""}`
        }
    });

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

      // Post-processing detection
      if (line.startsWith("[ffmpeg]") || line.startsWith("[VideoConvertor]")) {
        updateJob(jobId, { status: "Post-processing" });
      }
    });

    cmd.stderr.on("data", (line) => {
      addLog({ level: "error", message: `STDERR: ${line}`, jobId });
    });

    await cmd.spawn();
  } catch (e) {
    addLog({ level: "error", message: `Failed to spawn process: ${e}`, jobId });
    updateJob(jobId, { status: "Failed" });
  }
}
