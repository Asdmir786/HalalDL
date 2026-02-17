import { NIGHTLY_CAPABLE_TOOLS, type Tool, type ToolChannel } from "@/store/tools";
import { MotionButton } from "@/components/motion/MotionButton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  RefreshCcw,
  ExternalLink,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Download,
  ArrowRight,
  Search,
  RotateCcw,
  MapPin,
  Moon,
  Sun,
  Undo2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { revealToolInExplorer } from "@/lib/commands";
import {
  TOOL_URLS,
  TOOL_DESCRIPTIONS,
  getLatestTrackForTool,
  getLatestSourceForTool,
} from "../constants";

export interface ToolRowProps {
  tool: Tool;
  isLast: boolean;
  isBusy: boolean;
  isTransferActive: boolean;
  onRefresh: (id: string) => void;
  onInstallOrUpdate: (tool: Tool) => void;
  onPipUpgrade: (tool: Tool) => void;
  onUpdateOriginal: (tool: Tool) => void;
  onChannelChange: (tool: Tool, channel: ToolChannel) => void;
  onManualPath: (tool: Tool) => void;
  onResetToAuto: (tool: Tool) => void;
  onRollback: (tool: Tool) => void;
  onCleanupBackup: (tool: Tool) => void;
}

export function ToolRow({
  tool,
  isLast,
  isBusy,
  isTransferActive,
  onRefresh,
  onInstallOrUpdate,
  onPipUpgrade,
  onUpdateOriginal,
  onChannelChange,
  onManualPath,
  onResetToAuto,
  onRollback,
  onCleanupBackup,
}: ToolRowProps) {
  const isPip = tool.variant === "pip";
  const disableUpgradeActions = isTransferActive;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30",
        !isLast && "border-b border-white/4"
      )}
    >
      {/* Status indicator + info */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <div
          className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0 ring-4 transition-colors",
            tool.status === "Detected"
              ? "bg-green-500 ring-green-500/10"
              : tool.status === "Checking"
                ? "bg-yellow-500 ring-yellow-500/10 animate-pulse"
                : "bg-red-500 ring-red-500/10"
          )}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{tool.name}</span>
            {tool.required && (
              <Badge
                variant="secondary"
                className="text-[9px] uppercase h-4 px-1.5 font-bold"
              >
                Required
              </Badge>
            )}
            {tool.variant && tool.status === "Detected" && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 font-medium text-muted-foreground border-white/10"
              >
                {tool.variant}
              </Badge>
            )}
            {tool.channel === "nightly" && (
              <Badge
                variant="outline"
                className="text-[9px] h-4 px-1.5 font-medium text-amber-400 border-amber-400/20 bg-amber-400/5"
              >
                <Moon className="w-2.5 h-2.5 mr-0.5" />
                Nightly
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate" title={tool.systemPath || tool.path || ""}>
            {tool.mode === "Manual" && tool.path
              ? tool.path
              : tool.systemPath
                ? tool.systemPath
                : TOOL_DESCRIPTIONS[tool.id]}
          </p>
        </div>
      </div>

      {/* Version info */}
      <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs font-mono shrink-0 min-w-[170px]">
        {tool.version ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{tool.version}</span>
            {tool.updateAvailable && tool.latestVersion && (
              <>
                <ArrowRight className="w-3 h-3 text-primary" />
                <span className="text-primary font-semibold">
                  {tool.latestVersion}
                </span>
              </>
            )}
          </div>
        ) : tool.status === "Checking" ? (
          <span className="text-muted-foreground/50 text-[11px]">
            Checking...
          </span>
        ) : (
          <span className="text-muted-foreground/40 italic text-[11px]">
            Not installed
          </span>
        )}
        {tool.latestCheckedAt && (
          <span
            className="text-[10px] text-muted-foreground/70"
            title={`Latest source: ${getLatestSourceForTool(
              tool.id,
              getLatestTrackForTool(tool.id, tool.channel)
            )}`}
          >
            Latest track: {getLatestTrackForTool(tool.id, tool.channel)}
          </span>
        )}
      </div>

      {/* Primary action + overflow */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isBusy ? (
          <MotionButton
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            disabled
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            Working
          </MotionButton>
        ) : tool.status === "Missing" ? (
          <MotionButton
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => onInstallOrUpdate(tool)}
            disabled={disableUpgradeActions}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Install
          </MotionButton>
        ) : tool.updateAvailable ? (
          <MotionButton
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() =>
              isPip ? onPipUpgrade(tool) : onInstallOrUpdate(tool)
            }
            disabled={disableUpgradeActions}
          >
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
            {isPip ? "pip upgrade" : "Update"}
          </MotionButton>
        ) : (
          <Badge
            variant="outline"
            className="h-7 px-2.5 gap-1.5 text-[11px] font-medium text-green-500 border-green-500/20 bg-green-500/5"
          >
            <CheckCircle2 className="w-3 h-3" />
            Ready
          </Badge>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <MotionButton variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-4 h-4" />
            </MotionButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => onRefresh(tool.id)}
              disabled={isBusy}
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-2" />
              Refresh status
            </DropdownMenuItem>
            {isPip && tool.id === "yt-dlp" && tool.status === "Detected" && (
              <DropdownMenuItem
                onClick={() => onInstallOrUpdate(tool)}
                disabled={isBusy || disableUpgradeActions}
              >
                <Download className="w-3.5 h-3.5 mr-2" />
                Switch to GitHub standalone
              </DropdownMenuItem>
            )}
            {!isPip && tool.id === "yt-dlp" && tool.updateAvailable && (
              <DropdownMenuItem
                onClick={() => onPipUpgrade(tool)}
                disabled={isBusy || disableUpgradeActions}
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                Update via pip
              </DropdownMenuItem>
            )}
            {tool.systemPath && !isPip && tool.variant !== "Bundled" && tool.variant !== "Bundled (Full)" && tool.updateAvailable && (
              <DropdownMenuItem
                onClick={() => onUpdateOriginal(tool)}
                disabled={isBusy || disableUpgradeActions}
              >
                <MapPin className="w-3.5 h-3.5 mr-2" />
                Update at original location
              </DropdownMenuItem>
            )}
            {(NIGHTLY_CAPABLE_TOOLS as readonly string[]).includes(tool.id) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onChannelChange(tool, tool.channel === "nightly" ? "stable" : "nightly")}
                  disabled={isBusy}
                >
                  {tool.channel === "nightly" ? (
                    <>
                      <Sun className="w-3.5 h-3.5 mr-2" />
                      Switch to Stable
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 mr-2" />
                      Switch to Nightly
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openUrl(TOOL_URLS[tool.id])}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Visit website
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => revealToolInExplorer(tool.id, tool.path || tool.systemPath)}
            >
              <FolderOpen className="w-3.5 h-3.5 mr-2" />
              Open in Explorer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onManualPath(tool)}>
              <Search className="w-3.5 h-3.5 mr-2" />
              Set custom path...
            </DropdownMenuItem>
            {tool.mode === "Manual" && (
              <DropdownMenuItem onClick={() => onResetToAuto(tool)}>
                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                Reset to auto-detect
              </DropdownMenuItem>
            )}
            {tool.hasBackup && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onRollback(tool)}
                  disabled={isBusy}
                >
                  <Undo2 className="w-3.5 h-3.5 mr-2" />
                  Revert to previous
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onCleanupBackup(tool)}
                  disabled={isBusy}
                  className="text-muted-foreground"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete old version
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
