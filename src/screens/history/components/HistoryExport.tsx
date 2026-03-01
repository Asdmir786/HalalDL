import { Download, FileText, FileSpreadsheet, Link } from "lucide-react";
import { type HistoryEntry } from "@/store/history";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MotionButton } from "@/components/motion/MotionButton";

interface HistoryExportProps {
  entries: HistoryEntry[];
}

function entriesToCsv(entries: HistoryEntry[]): string {
  const header = "Title,URL,Date,Format,Size (bytes),Status,Domain";
  const rows = entries.map((e) => {
    const date = new Date(e.downloadedAt).toISOString();
    const title = `"${(e.title ?? "").replace(/"/g, '""')}"`;
    const url = `"${e.url}"`;
    return `${title},${url},${date},${e.format ?? ""},${e.fileSize ?? ""},${e.status},${e.domain}`;
  });
  return [header, ...rows].join("\n");
}

function entriesToUrlList(entries: HistoryEntry[]): string {
  return entries.map((e) => e.url).join("\n");
}

async function exportToFile(content: string, defaultName: string, filterLabel: string, ext: string) {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: filterLabel, extensions: [ext] }],
  });
  if (!path) return;
  await writeTextFile(path, content);
  toast.success("Exported successfully", { description: path });
}

export function HistoryExport({ entries }: HistoryExportProps) {
  if (entries.length === 0) return null;

  const handleJson = async () => {
    const json = JSON.stringify(entries, null, 2);
    await exportToFile(json, "halaldl-history.json", "JSON", "json");
  };

  const handleCsv = async () => {
    const csv = entriesToCsv(entries);
    await exportToFile(csv, "halaldl-history.csv", "CSV", "csv");
  };

  const handleUrlList = async () => {
    const list = entriesToUrlList(entries);
    await exportToFile(list, "halaldl-urls.txt", "Text", "txt");
  };

  const handleCopyUrls = () => {
    const list = entriesToUrlList(entries);
    navigator.clipboard.writeText(list);
    toast.success(`${entries.length} URLs copied to clipboard`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MotionButton
          variant="outline"
          size="sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </MotionButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleJson}>
          <FileText className="w-3.5 h-3.5 mr-2" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCsv}>
          <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleUrlList}>
          <Link className="w-3.5 h-3.5 mr-2" />
          Export URL list
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyUrls}>
          <Link className="w-3.5 h-3.5 mr-2" />
          Copy all URLs
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
