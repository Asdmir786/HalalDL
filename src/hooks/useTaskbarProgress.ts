import { useEffect, useRef } from "react";
import { getCurrentWindow, ProgressBarStatus } from "@tauri-apps/api/window";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";

export function useTaskbarProgress() {
  const jobs = useDownloadsStore((state) => state.jobs);
  const loggedErrorRef = useRef(false);

  useEffect(() => {
    const activeJobs = jobs.filter(
      (job) => job.status === "Downloading" || job.status === "Post-processing"
    );

    const updateTaskbar = async () => {
      try {
        const appWindow = getCurrentWindow();

        if (activeJobs.length === 0) {
          await appWindow.setProgressBar({
            status: ProgressBarStatus.None,
          });
          return;
        }

        const totalProgress = activeJobs.reduce((acc, job) => {
          if (job.status === "Post-processing") return acc + 100;
          return acc + (job.progress || 0);
        }, 0);

        const avgProgress = Math.round(totalProgress / activeJobs.length);

        await appWindow.setProgressBar({
          status: ProgressBarStatus.Normal,
          progress: avgProgress,
        });
      } catch (err) {
        if (!loggedErrorRef.current) {
          loggedErrorRef.current = true;
          useLogsStore.getState().addLog({ level: "warn", message: `Failed to update taskbar progress: ${String(err)}` });
        }
      }
    };

    updateTaskbar();
  }, [jobs]);
}
