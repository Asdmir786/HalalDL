import { readTextFile } from "@/lib/commands";
import { fetchMediaInfo } from "@/lib/downloader";
import { classifyYtDlpFailure } from "@/lib/downloader/failure-messages";

export async function validateCookiesFile(path: string) {
  if (!path.trim()) return { valid: false, message: "No cookies.txt file selected." };
  try {
    const header = (await readTextFile(path)).slice(0, 120);
    const valid = /^# (HTTP Cookie File|Netscape HTTP Cookie File)/m.test(header);
    return { valid, message: valid ? "Netscape cookies.txt format detected." : "This file is not a Netscape cookies.txt export." };
  } catch { return { valid: false, message: "The selected cookie file could not be read." }; }
}

export async function probeReliability(url: string) {
  try { const info = await fetchMediaInfo(url); return { ok: true, message: `Media access works: ${info.title || "source resolved"}.` }; }
  catch (error) { const raw = error instanceof Error ? error.message : String(error); return { ok: false, message: classifyYtDlpFailure(raw) || raw.slice(0, 280) }; }
}
