import { readTextFile } from "@/lib/commands";
import { fetchMediaInfo } from "@/lib/downloader";
import { classifyYtDlpFailure } from "@/lib/downloader/failure-messages";

export async function validateCookiesFile(path: string) {
  if (!path.trim()) return { valid: false, message: "No sign-in file selected." };
  try {
    const header = (await readTextFile(path)).slice(0, 120);
    const valid = /^# (HTTP Cookie File|Netscape HTTP Cookie File)/m.test(header);
    return { valid, message: valid ? "This sign-in file looks usable." : "This does not look like a cookies.txt export. Export it again, then choose the new file." };
  } catch { return { valid: false, message: "HalalDL could not read the selected sign-in file." }; }
}

export async function probeReliability(url: string) {
  try { const info = await fetchMediaInfo(url); return { ok: true, message: `This link can be read: ${info.title || "media found"}.` }; }
  catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const message = classifyYtDlpFailure(raw) || raw.slice(0, 280);
    return { ok: false, message: message.replace(/\s+/g, " ").trim() };
  }
}
