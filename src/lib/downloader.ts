import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { OutputParser } from "@/lib/output-parser";

import { sendNotification, requestPermission, isPermissionGranted } from '@tauri-apps/plugin-notification';

async function sendDownloadCompleteNotification(title: string, body: string) {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    
    if (permissionGranted) {
      sendNotification({
        title,
        body,
      });
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}

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
  const { jobs, updateJob, removeJob } = useDownloadsStore.getState();

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
  args.push("--ignore-config", "--newline", "--no-colors", "--no-playlist");

  // Speed Limit
  if (settings.maxSpeed && settings.maxSpeed > 0) {
    args.push("--limit-rate", `${settings.maxSpeed}K`);
  }

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
        
        // Send Notification
        const { settings } = useSettingsStore.getState();
        if (settings.notifications) {
           const finalJob = useDownloadsStore.getState().jobs.find(j => j.id === jobId);
           if (finalJob) {
             const title = finalJob.title || "Download Complete";
             sendDownloadCompleteNotification("Download Finished", `${title} has been downloaded successfully.`);
           }
        }

        // Auto-clear if enabled
        if (settings.autoClearFinished) {
           setTimeout(() => {
             removeJob(jobId);
           }, 2000); 
        }
      } else {
        updateJob(jobId, { status: "Failed" });
      }
    });

    cmd.on("error", (error) => {
      addLog({ level: "error", message: `Process error: ${error}`, jobId });
      updateJob(jobId, { status: "Failed" });
    });

    const outputParser = new OutputParser();
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 500;

    cmd.stdout.on("data", (line) => {
      addLog({ level: "info", message: line, jobId });
      
      const now = Date.now();
      const shouldUpdate = now - lastUpdate > UPDATE_INTERVAL;

      const update = outputParser.parse(line);
      
      if (update) {
        // If it's just progress/speed/eta, throttle it
        if (update.progress || update.speed || update.eta) {
           if (shouldUpdate) {
             updateJob(jobId, update);
             lastUpdate = now;
           }
        } else {
           // Important updates (status, title, path) - apply immediately
           updateJob(jobId, update);
        }
      }
    });

    cmd.stderr.on("data", (line) => {
      addLog({ level: "error", message: `STDERR: ${line}`, jobId });
      
      // Some aria2 errors might come through stderr
      if (line.includes("aria2c") || line.includes("downloader")) {
        // Log it as an error but keep status as Failed (compatible with JobStatus type)
        addLog({ level: "error", message: "Downloader specific error detected", jobId });
        // Don't set failed immediately, let the process exit code decide unless it's a critical error
        // updateJob(jobId, { status: "Failed" });
      }
    });

    await cmd.spawn();
  } catch (e) {
    addLog({ level: "error", message: `Failed to spawn process: ${e}`, jobId });
    updateJob(jobId, { status: "Failed" });
  }
}

export async function fetchMetadata(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  try {
    const ytDlpPath = await getToolPath("yt-dlp");
    
    // Use --print to get metadata without downloading
    // We get title and thumbnail
    const cmd = Command.create(ytDlpPath, [
      "--print",
      "%(title)s:::%(thumbnail)s",
      "--skip-download",
      "--no-warnings",
      "--flat-playlist",
      "--referer", job.url, // Helps with some sites like Instagram
      job.url
    ]);

    const output = await cmd.execute();
    
    if (output.code === 0) {
      const parts = output.stdout.trim().split(":::");
      if (parts.length >= 2) {
        const title = parts[0].trim();
        const thumbnail = parts[1].trim();
        
        updateJob(jobId, { 
          title: title || job.title, 
          thumbnail: thumbnail 
        });
      }
    }
  } catch (e) {
    console.error("Failed to fetch metadata:", e);
  }
}
