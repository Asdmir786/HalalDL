import { DownloadJob } from "@/store/downloads";

export function getJobTs(job: DownloadJob) {
  return (typeof job.statusChangedAt === "number" ? job.statusChangedAt : job.createdAt) || 0;
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMediaDuration(seconds: number | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}
