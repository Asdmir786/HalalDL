import { toast } from "sonner";
import { resolveSystemToolPath } from "@/lib/commands";
import { resolveTool } from "@/lib/downloader/tool-env";
import { getAppMode } from "@/lib/tools/app-mode";
import { getMissingAppManagedToolIds } from "@/lib/tools/local-tools";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";

/**
 * Cheap readiness check before starting a download.
 * Does not spawn `yt-dlp --version` — only file/PATH presence.
 */
export async function ensureYtDlpAvailable(): Promise<boolean> {
  const { updateTool } = useToolsStore.getState();
  const { addLog } = useLogsStore.getState();
  const appMode = getAppMode();

  try {
    if (appMode !== "LITE") {
      const missing = await getMissingAppManagedToolIds(["yt-dlp"]);
      if (missing.includes("yt-dlp")) {
        updateTool("yt-dlp", {
          status: "Missing",
          version: undefined,
          usingFallback: false,
        });
        addLog({
          level: "warn",
          message: "Download blocked: app-managed yt-dlp is missing",
        });
        toast.error("yt-dlp is not installed", {
          description: "Install it from the setup prompt or the Tools screen.",
        });
        return false;
      }

      updateTool("yt-dlp", {
        status: "Detected",
        usingFallback: false,
      });
      return true;
    }

    const tool = await resolveTool("yt-dlp");
    if (tool.isLocal) {
      updateTool("yt-dlp", {
        status: "Detected",
        systemPath: tool.path,
        usingFallback: false,
      });
      return true;
    }

    const systemPath = await resolveSystemToolPath("yt-dlp").catch(() => null);
    if (!systemPath) {
      updateTool("yt-dlp", {
        status: "Missing",
        version: undefined,
        usingFallback: false,
      });
      addLog({
        level: "warn",
        message: "Download blocked: yt-dlp not found on PATH",
      });
      toast.error("yt-dlp was not found", {
        description: "Install yt-dlp on your PATH, or switch to Full mode.",
      });
      return false;
    }

    updateTool("yt-dlp", {
      status: "Detected",
      systemPath,
      usingFallback: true,
    });
    return true;
  } catch (error) {
    addLog({
      level: "error",
      message: `yt-dlp readiness check failed: ${String(error)}`,
    });
    toast.error("Could not verify yt-dlp", {
      description: String(error),
    });
    return false;
  }
}
