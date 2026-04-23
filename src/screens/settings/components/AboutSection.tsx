import { useCallback, useEffect, useState } from "react";
import {
  Info,
  ExternalLink,
  FolderGit2,
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
  Loader2,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { exit } from "@tauri-apps/plugin-process";
import { open } from "@tauri-apps/plugin-shell";
import { MotionButton } from "@/components/motion/MotionButton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  downloadAndVerifyAppUpdate,
  openFile,
  revealInExplorer,
  type InstallerType,
} from "@/lib/commands";
import { useAppUpdateStore } from "@/store/app-update";
import { SettingsSection } from "./SettingsSection";
import { toast } from "sonner";
import { useDownloadsStore } from "@/store/downloads";
import { checkAndStoreAppUpdate } from "@/lib/app-updates/service";
import { notifyUser } from "@/lib/notifications";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { getAppMode } from "@/lib/tools/app-mode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REPO_URL = "https://github.com/Asdmir786/HalalDL";
const RELEASES_URL = `${REPO_URL}/releases`;
const ISSUES_URL = `${REPO_URL}/issues`;

type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "update-available"
  | "error";

async function openUrl(url: string) {
  try {
    await open(url);
  } catch {
    return;
  }
}

export function AboutSection() {
  const [version, setVersion] = useState(() => (isDemoModeEnabled() ? "0.4.0" : "..."));
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseUrl, setReleaseUrl] = useState<string>(RELEASES_URL);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState<string | null>(null);
  const [checksumUrl, setChecksumUrl] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [verifiedInstallerPath, setVerifiedInstallerPath] = useState<
    string | null
  >(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [isLaunchingInstaller, setIsLaunchingInstaller] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const appMode = getAppMode();
  const appModeLabel =
    appMode === "FULL" ? "Full" : appMode === "PORTABLE" ? "Portable" : "Lite";

  const storeUpdate = useAppUpdateStore();
  const installerType = storeUpdate.installContext?.installerType ?? "unknown";
  const isPortableInstall =
    appMode === "PORTABLE" || installerType === "portable";
  const packageLabel = formatPackageLabel(installerType);
  const installActionLabel = "Install and Close";
  const jobs = useDownloadsStore((s) => s.jobs);
  const activeJobCount = jobs.filter(
    (job) => job.status === "Downloading" || job.status === "Post-processing"
  ).length;
  const canInstallUpdate =
    activeJobCount === 0 && Boolean(verifiedInstallerPath);

  useEffect(() => {
    if (isDemoModeEnabled()) {
      return;
    }
    getVersion()
      .then(setVersion)
      .catch(() => setVersion("unknown"));
  }, []);

  useEffect(() => {
    if (storeUpdate.updateAvailable && storeUpdate.latestVersion) {
      setLatestVersion(storeUpdate.latestVersion);
      setReleaseUrl(storeUpdate.releaseUrl ?? RELEASES_URL);
      setDownloadUrl(storeUpdate.downloadUrl);
      setAssetName(storeUpdate.assetName);
      setChecksumUrl(storeUpdate.checksumUrl);
      setUpdateStatus("update-available");
    }
  }, [
    storeUpdate.updateAvailable,
    storeUpdate.latestVersion,
    storeUpdate.releaseUrl,
    storeUpdate.downloadUrl,
    storeUpdate.assetName,
    storeUpdate.checksumUrl,
  ]);

  useEffect(() => {
    setVerifiedInstallerPath(null);
    setInstallDialogOpen(false);
  }, [assetName, latestVersion]);

  const checkForUpdates = useCallback(async () => {
    setUpdateStatus("checking");
    try {
      const appUpdate = await checkAndStoreAppUpdate(version);
      const result = appUpdate.resolved;
      setLatestVersion(result.latestVersion);
      setReleaseUrl(result.releaseUrl);
      setDownloadUrl(result.downloadUrl);
      setAssetName(result.assetName);
      setChecksumUrl(result.checksumUrl);

      if (result.latestVersion && version !== "..." && version !== "unknown") {
        if (result.updateAvailable) {
          setUpdateStatus("update-available");
        } else {
          setUpdateStatus("up-to-date");
        }
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch {
      setUpdateStatus("error");
    }
  }, [version]);

  const handleDownloadUpdate = useCallback(async () => {
    if (isPortableInstall) {
      await openUrl(releaseUrl);
      return;
    }

    if (!downloadUrl || !assetName || !checksumUrl) {
      await openUrl(releaseUrl);
      return;
    }

    setIsDownloadingUpdate(true);
    try {
      const verifiedPath = await downloadAndVerifyAppUpdate({
        downloadUrl,
        assetName,
        checksumUrl,
      });
      await notifyUser(
        "HalalDL update ready",
        "The verified installer has been downloaded and is ready to run.",
        "success",
        {
          screen: "settings",
          targetType: "section",
          targetId: "about",
          reason: "app-update-ready",
          actionLabel: "Open About",
        }
      );
      setVerifiedInstallerPath(verifiedPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Verified update failed: ${message}`);
    } finally {
      setIsDownloadingUpdate(false);
    }
  }, [assetName, checksumUrl, downloadUrl, isPortableInstall, releaseUrl]);

  const handleInstallUpdate = useCallback(async () => {
    if (!verifiedInstallerPath) return;
    if (activeJobCount > 0) {
      toast.error("Finish active downloads before installing the update.");
      setInstallDialogOpen(false);
      return;
    }

    setIsLaunchingInstaller(true);
    try {
      await openFile(verifiedInstallerPath);
      await exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to start installer: ${message}`);
    } finally {
      setIsLaunchingInstaller(false);
      setInstallDialogOpen(false);
    }
  }, [activeJobCount, verifiedInstallerPath]);

  return (
    <SettingsSection
      id="about"
      icon={Info}
      title="About"
      description="App info, updates, and links."
    >
      {/* Version + Update check */}
      <div className="space-y-4 rounded-xl border border-border/30 bg-muted/15 p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl font-bold tracking-tight">HalalDL</span>
              <Badge variant="secondary" className="font-mono text-xs">
                v{version}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 border-border/60 px-2 text-[10px] font-semibold tracking-wide dark:border-white/10",
                  appModeLabel === "Full" || appModeLabel === "Portable"
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {appModeLabel}
              </Badge>
              <Badge
                variant="outline"
                className="h-5 max-w-full border-border/60 px-2 text-[10px] font-semibold tracking-wide dark:border-white/10"
              >
                {packageLabel}
              </Badge>
            </div>
            <p className="max-w-2xl text-xs text-muted-foreground">
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
            className="w-full sm:w-auto sm:shrink-0"
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
          <div className="flex items-start gap-2.5 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                You're up to date!
              </p>
              <p className="text-xs text-muted-foreground">
                HalalDL v{version} is the latest version.
              </p>
            </div>
          </div>
        )}

        {updateStatus === "update-available" && latestVersion && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
              <ArrowUpCircle className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Update available — v{latestVersion}
                </p>
                  <p className="text-xs text-muted-foreground">
                  You're on v{version}.{" "}
                  {assetName
                    ? `Preferred package: ${assetName}`
                    : "A newer version is ready."}
                </p>
                  {assetName && (
                    <div className="overflow-x-auto rounded-md border border-blue-500/15 bg-background/40 px-2.5 py-2 text-[11px] font-mono text-muted-foreground">
                      {assetName}
                    </div>
                  )}
                {verifiedInstallerPath && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Update ready. SHA-256 checksum verified.
                  </p>
                )}
                {isPortableInstall && (
                  <p className="text-xs text-muted-foreground">
                    Portable builds update manually from GitHub Releases.
                  </p>
                )}
                {!isPortableInstall && !verifiedInstallerPath && checksumUrl && (
                  <p className="text-xs text-muted-foreground">
                    Package checksum will be verified before install.
                  </p>
                )}
              </div>
              </div>
              <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[230px] lg:grid-cols-1">
                {isPortableInstall ? (
                  <MotionButton
                    size="sm"
                    onClick={() => void openUrl(releaseUrl)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:col-span-2 lg:col-span-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open Release Page
                  </MotionButton>
                ) : verifiedInstallerPath ? (
                  <>
                    <MotionButton
                      size="sm"
                      onClick={() => setInstallDialogOpen(true)}
                      disabled={!canInstallUpdate || isLaunchingInstaller}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-full"
                    >
                      {isLaunchingInstaller ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Install Update
                    </MotionButton>
                    <MotionButton
                      variant="outline"
                      size="sm"
                      onClick={() => void revealInExplorer(verifiedInstallerPath)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full"
                    >
                      Open Folder
                    </MotionButton>
                  </>
                ) : (
                  <MotionButton
                    size="sm"
                    onClick={() => void handleDownloadUpdate()}
                    disabled={isDownloadingUpdate}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:col-span-2 lg:col-span-1"
                  >
                    {isDownloadingUpdate ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {downloadUrl && checksumUrl
                      ? "Download Update"
                      : "View Release"}
                  </MotionButton>
                )}
              </div>
            </div>
          </div>
        )}

        {!isPortableInstall && verifiedInstallerPath && activeJobCount === 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Update ready to install
              </p>
              <p className="text-xs text-muted-foreground">
                Saved to Downloads. HalalDL will close before the installer runs.
              </p>
            </div>
          </div>
        )}

        {!isPortableInstall && verifiedInstallerPath && activeJobCount > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <Info className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Finish active downloads before installing
              </p>
              <p className="text-xs text-muted-foreground">
                {activeJobCount} active job{activeJobCount === 1 ? "" : "s"}{" "}
                still running.
              </p>
            </div>
          </div>
        )}

        {updateStatus === "error" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <Info className="w-5 h-5 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">
                Couldn't check for updates
              </p>
              <p className="text-xs text-muted-foreground">
                Check your internet connection and try again.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <LinkCard
          icon={FolderGit2}
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

      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Install update now?</DialogTitle>
            <DialogDescription>
              {`HalalDL will close before launching the verified ${packageLabel} package.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="grid gap-2 rounded-lg border border-border/40 bg-muted/20 p-3 sm:grid-cols-3">
              <p>Version: v{latestVersion ?? "unknown"}</p>
              <p>Checksum: SHA-256 verified</p>
              <p>Jobs active: {activeJobCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-foreground/90">Package</p>
              <div className="max-h-24 overflow-auto rounded-lg border border-border/40 bg-muted/20 px-3 py-2 font-mono text-xs">
                {assetName ?? "Unknown package"}
              </div>
            </div>
            {activeJobCount > 0 && (
              <p className="text-amber-700 dark:text-amber-400">
                Active downloads are still running. Finish them before
                installing.
              </p>
            )}
          </div>
          <DialogFooter>
            <MotionButton
              type="button"
              variant="ghost"
              onClick={() => setInstallDialogOpen(false)}
            >
              Cancel
            </MotionButton>
            <MotionButton
              type="button"
              onClick={() => void handleInstallUpdate()}
              disabled={!canInstallUpdate || isLaunchingInstaller}
            >
              {isLaunchingInstaller ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {installActionLabel}
            </MotionButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

function formatPackageLabel(installerType: InstallerType): string {
  if (installerType === "msi") return "MSI";
  if (installerType === "nsis") return "NSIS";
  if (installerType === "portable") return "Portable ZIP";
  return "Package Unknown";
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
        "group flex items-center gap-3 rounded-xl border border-border/30 bg-muted/15 px-4 py-3",
        "text-left transition-all duration-200 cursor-pointer",
        "hover:bg-muted/30 hover:border-border/50 hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="p-2 rounded-lg bg-primary/5 text-primary/70 group-hover:bg-primary/10 transition-colors shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
    </button>
  );
}
