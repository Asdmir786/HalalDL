import { Command } from "@tauri-apps/plugin-shell";

export async function checkYtDlpVersion(): Promise<string | null> {
  try {
    // Try running 'yt-dlp --version'
    const cmd = Command.create("yt-dlp", ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      return output.stdout.trim();
    }
  } catch (e) {
    console.warn("yt-dlp check failed:", e);
  }
  return null;
}

export async function checkFfmpegVersion(): Promise<string | null> {
  try {
    // ffmpeg prints version to stderr or stdout depending on version/build, usually just 'ffmpeg -version' works
    const cmd = Command.create("ffmpeg", ["-version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      // Parse first line: "ffmpeg version n.n.n ..."
      const firstLine = output.stdout.split('\n')[0];
      return firstLine || "Detected";
    }
  } catch (e) {
    console.warn("ffmpeg check failed:", e);
  }
  return null;
}

export async function checkAria2Version(): Promise<string | null> {
  try {
    const cmd = Command.create("aria2c", ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0];
      return firstLine || "Detected";
    }
  } catch (e) {
    console.warn("aria2c check failed:", e);
  }
  return null;
}
