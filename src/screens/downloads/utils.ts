import { DownloadJob } from "@/store/downloads";

export function getJobTs(job: DownloadJob) {
  return (typeof job.statusChangedAt === "number" ? job.statusChangedAt : job.createdAt) || 0;
}
