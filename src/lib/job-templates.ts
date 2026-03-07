import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { useDownloadsStore, type DownloadJob } from "@/store/downloads";
import { toast } from "sonner";

type JobTemplateItem = {
  url: string;
  presetId: string;
  overrides?: DownloadJob["overrides"];
};

type JobTemplateFile = {
  version: 1;
  createdAt: string;
  jobs: JobTemplateItem[];
};

export async function exportJobTemplate(selectedIds: string[]) {
  const jobs = useDownloadsStore.getState().jobs;
  const selectedSet = new Set(selectedIds);
  const picked = selectedIds.length > 0 ? jobs.filter((j) => selectedSet.has(j.id)) : jobs;
  const items: JobTemplateItem[] = picked.map((j) => ({
    url: j.url,
    presetId: j.presetId,
    overrides: j.overrides,
  }));

  if (items.length === 0) {
    toast.info("No jobs to export");
    return;
  }

  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}_${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`;

  const path = await save({
    filters: [{ name: "JSON", extensions: ["json"] }],
    defaultPath: `HalalDL-jobs-${stamp}.json`,
  });
  if (!path) return;

  const payload: JobTemplateFile = {
    version: 1,
    createdAt: new Date().toISOString(),
    jobs: items,
  };

  await invoke("write_text_file", { path, contents: JSON.stringify(payload, null, 2) });
  toast.success("Exported jobs", { description: `${items.length} job(s)` });
}

export async function importJobTemplate() {
  const path = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  });
  if (!path) return;

  const raw = await invoke<string>("read_text_file", { path });
  const parsed = JSON.parse(raw) as Partial<JobTemplateFile>;
  const list = Array.isArray(parsed.jobs) ? parsed.jobs : [];
  const jobs = list.filter((j): j is JobTemplateItem => Boolean(j && typeof j.url === "string" && typeof j.presetId === "string"));

  if (jobs.length === 0) {
    toast.error("No jobs found in file");
    return;
  }

  const addJob = useDownloadsStore.getState().addJob;
  for (const j of [...jobs].reverse()) {
    addJob(j.url, j.presetId, j.overrides);
  }
  toast.success("Imported jobs", { description: `${jobs.length} job(s)` });
}

