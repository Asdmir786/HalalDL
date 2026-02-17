import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Download,
  type LucideIcon,
} from "lucide-react";
import type { DownloadJob } from "@/store/downloads";

export const PHASE_ORDER = [
  "Resolving formats",
  "Downloading streams",
  "Merging streams",
  "Converting with FFmpeg",
  "Generating thumbnail",
] as const;

export type Phase = (typeof PHASE_ORDER)[number];

export interface StatusMeta {
  Icon: LucideIcon;
  badgeClassName: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  Queued: {
    Icon: Clock,
    badgeClassName:
      "text-yellow-300 border-yellow-500/20 bg-yellow-500/10 shadow-[0_0_0_1px_rgba(234,179,8,0.12)]",
  },
  Failed: {
    Icon: AlertTriangle,
    badgeClassName:
      "text-destructive border-destructive/25 bg-destructive/10 shadow-[0_0_0_1px_rgba(239,68,68,0.14)]",
  },
  Done: {
    Icon: CheckCircle2,
    badgeClassName:
      "text-emerald-300 border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]",
  },
  "Post-processing": {
    Icon: Sparkles,
    badgeClassName:
      "text-violet-300 border-violet-500/20 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.14)]",
  },
};

const DEFAULT_STATUS_META: StatusMeta = {
  Icon: Download,
  badgeClassName:
    "text-blue-300 border-blue-500/20 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.14)]",
};

export function getStatusMeta(status: DownloadJob["status"]): StatusMeta {
  return STATUS_META[status] ?? DEFAULT_STATUS_META;
}
