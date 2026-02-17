import { useCallback, useEffect, useState } from "react";
import {
  Info, ExternalLink, Github, RefreshCw,
  CheckCircle2, ArrowUpCircle, Loader2,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MotionButton } from "@/components/motion/MotionButton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppUpdateStore } from "@/store/app-update";

const REPO_URL = "https://github.com/Asdmir786/HalalDL";
const RELEASES_URL = `${REPO_URL}/releases`;
const ISSUES_URL = `${REPO_URL}/issues`;
const LATEST_API = "https://api.github.com/repos/Asdmir786/HalalDL/releases/latest";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "update-available" | "error";

function openUrl(url: string) {
  window.open(url, "_blank");
}

export function AboutSection() {
  const [version, setVersion] = useState("...");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string>(RELEASES_URL);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");

  const storeUpdate = useAppUpdateStore();

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("unknown"));
  }, []);

  // If the background check already found an update, reflect it immediately
  useEffect(() => {
    if (storeUpdate.updateAvailable && storeUpdate.latestVersion) {
      setLatestVersion(storeUpdate.latestVersion);
      setReleaseUrl(storeUpdate.releaseUrl ?? RELEASES_URL);
      setUpdateStatus("update-available");
    }
  }, [storeUpdate.updateAvailable, storeUpdate.latestVersion, storeUpdate.releaseUrl]);

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus("checking");
    try {
      const res = await fetch(LATEST_API, {
        headers: { Accept: "application/vnd.github.v3+json" },
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      const tag: string = data.tag_name ?? "";
      const latest = tag.replace(/^v/, "");
      setLatestVersion(latest);
      setReleaseUrl(data.html_url ?? RELEASES_URL);

      if (latest && version !== "..." && version !== "unknown") {
        if (latest === version) {
          setUpdateStatus("up-to-date");
          // Clear any stale update indicator
          if (storeUpdate.updateAvailable) {
            useAppUpdateStore.setState({ updateAvailable: false, dismissed: false });
          }
        } else {
          setUpdateStatus("update-available");
          storeUpdate.setUpdate(latest, data.html_url ?? RELEASES_URL);
        }
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch {
      setUpdateStatus("error");
    }
  }, [version, storeUpdate]);

  return (
    <FadeInItem>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5" />
            About
          </CardTitle>
          <CardDescription>App info, updates, and links.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Version + Update check */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-bold tracking-tight">HalalDL</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  v{version}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                A modern, privacy-focused video downloader.
              </p>
            </div>

            <MotionButton
              variant="outline"
              size="sm"
              disabled={updateStatus === "checking"}
              onClick={checkForUpdates}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="shrink-0"
            >
              {updateStatus === "checking" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check for Updates
            </MotionButton>
          </div>

          {/* Update status feedback */}
          {updateStatus === "up-to-date" && (
            <div className="flex items-center gap-2.5 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400">You're up to date!</p>
                <p className="text-xs text-muted-foreground">
                  HalalDL v{version} is the latest version.
                </p>
              </div>
            </div>
          )}

          {updateStatus === "update-available" && latestVersion && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <ArrowUpCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-400">
                    Update available — v{latestVersion}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You're on v{version}. A newer version is ready.
                  </p>
                </div>
              </div>
              <MotionButton
                size="sm"
                onClick={() => openUrl(releaseUrl)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Download
              </MotionButton>
            </div>
          )}

          {updateStatus === "error" && (
            <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
              <Info className="w-5 h-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Couldn't check for updates</p>
                <p className="text-xs text-muted-foreground">
                  Check your internet connection and try again.
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <LinkCard
              icon={Github}
              title="Source Code"
              description="View on GitHub"
              onClick={() => openUrl(REPO_URL)}
            />
            <LinkCard
              icon={ExternalLink}
              title="Releases"
              description="Download builds"
              onClick={() => openUrl(RELEASES_URL)}
            />
            <LinkCard
              icon={Info}
              title="Report Issue"
              description="Bugs & feature requests"
              onClick={() => openUrl(ISSUES_URL)}
            />
          </div>
        </CardContent>
      </Card>
    </FadeInItem>
  );
}

function LinkCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3",
        "text-left transition-all duration-200 cursor-pointer",
        "hover:bg-muted/60 hover:border-border hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </button>
  );
}
