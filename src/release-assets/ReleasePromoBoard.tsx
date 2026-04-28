import {
  Archive,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Download,
  FolderArchive,
  FolderKanban,
  HardDriveDownload,
  Image as ImageIcon,
  Layers3,
  PackageCheck,
  Camera,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeName = "light" | "dark";
type SceneName = "hero" | "portable-mode" | "instagram-reliability" | "archive-contact-sheets";

type SceneCopy = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  accentLabel: string;
};

const sceneCopy: Record<SceneName, SceneCopy> = {
  hero: {
    eyebrow: "v0.5.0 · Portable Workflow Update",
    title: "Three ways to run HalalDL.\nOne cleaner daily flow.",
    body:
      "Portable joins Full and Lite, Instagram fallback got more reliable, and finished downloads now carry richer metadata, previews, and archive context.",
    bullets: [
      "New Portable ZIP with bundled tools beside the app",
      "Stronger Instagram and DownloadGram fallback handling",
      "Archive, thumbnails, metadata, and contact-sheet improvements",
    ],
    accentLabel: "Portable release ready",
  },
  "portable-mode": {
    eyebrow: "Portable mode",
    title: "Bring the app.\nBring the tools.\nSkip the install.",
    body:
      "The new portable build keeps HalalDL, its managed binaries, and its app data together in one portable folder for locked-down Windows setups.",
    bullets: [
      "portable-data stores state, tools, thumbnails, and archive beside the EXE",
      "Bundled yt-dlp, ffmpeg, ffprobe, aria2c, and deno",
      "Manual GitHub Releases update path instead of an in-place self-updater",
    ],
    accentLabel: "Portable bundle detected",
  },
  "instagram-reliability": {
    eyebrow: "Instagram reliability",
    title: "Fallback paths that\nhold up better\nwhen links get weird.",
    body:
      "Image-heavy Instagram cases, DownloadGram parsing, and local preview paths were tightened so the app can recover more gracefully when metadata is messy.",
    bullets: [
      "Hardened DownloadGram URL parsing",
      "Better fallback media fetches and thumbnail selection",
      "Richer finished-result metadata and more dependable image previews",
    ],
    accentLabel: "Fallback path improved",
  },
  "archive-contact-sheets": {
    eyebrow: "Archive and results",
    title: "Finished downloads\nfeel more complete\nafter they land.",
    body:
      "HalalDL now keeps a stronger trail of what happened: download archive data, richer result cards, metadata carry-through, and contact-sheet style browsing support.",
    bullets: [
      "Dedicated download archive storage",
      "Richer completed-result details and thumbnail context",
      "Contact-sheet support for browsing image-heavy jobs",
    ],
    accentLabel: "Post-download view upgraded",
  },
};

function useReleaseQuery() {
  const params = new URLSearchParams(window.location.search);
  const hashParts = window.location.hash.replace(/^#\/?/, "").split("/");
  const isHashMode = hashParts[0] === "release-promo" && hashParts[1] === "0.5.0";
  const hashScene = isHashMode ? (hashParts[2] as SceneName | undefined) : undefined;
  const hashTheme = isHashMode ? (hashParts[3] as ThemeName | undefined) : undefined;
  const theme = ((hashTheme ?? params.get("theme")) === "dark" ? "dark" : "light") as ThemeName;
  const sceneParam = (hashScene ?? params.get("scene")) as SceneName | null;
  const scene = sceneParam && sceneParam in sceneCopy ? sceneParam : "hero";
  return { theme, scene };
}

function SceneShell({
  theme,
  scene,
}: {
  theme: ThemeName;
  scene: SceneName;
}) {
  const copy = sceneCopy[scene];
  const isDark = theme === "dark";

  const shellClass = isDark ? "dark" : "";
  return (
    <div className={shellClass}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="relative isolate overflow-hidden">
          <ReleaseBackdrop scene={scene} />
          <div className="mx-auto flex min-h-screen w-[1600px] max-w-[1600px] flex-col px-12 py-10">
            <BoardHeader label={copy.accentLabel} />
            <div className="mt-8 grid flex-1 grid-cols-[0.95fr_1.05fr] gap-8">
              <div className="flex flex-col justify-between">
                <div className="max-w-[640px]">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-[14px] font-semibold tracking-[0.16em] text-emerald-500 uppercase">
                    <Sparkles className="h-4 w-4" />
                    {copy.eyebrow}
                  </div>
                  <h1 className="mt-8 whitespace-pre-line font-serif text-[80px] leading-[0.94] tracking-[-0.05em] text-balance">
                    {copy.title}
                  </h1>
                  <p className="mt-8 max-w-[620px] text-[26px] leading-[1.35] text-muted-foreground">
                    {copy.body}
                  </p>
                </div>
                <div className="mt-10 space-y-4">
                  {copy.bullets.map((bullet) => (
                    <div
                      key={bullet}
                      className="flex items-start gap-4 rounded-[28px] border border-border/60 bg-card/70 px-5 py-4 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.24)] backdrop-blur-xl"
                    >
                      <div className="mt-1 rounded-2xl bg-emerald-400/15 p-2 text-emerald-500">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <p className="text-[20px] leading-[1.45] text-foreground/92">{bullet}</p>
                    </div>
                  ))}
                </div>
              </div>

              <SceneVisual scene={scene} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-[18px] font-black text-emerald-950 shadow-[0_20px_60px_-24px_rgba(16,185,129,0.85)]">
          H
        </div>
        <div>
          <div className="text-[26px] font-semibold tracking-[-0.04em]">HalalDL</div>
          <div className="text-[14px] text-muted-foreground">Windows-first downloader built for real daily use</div>
        </div>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-[15px] font-semibold text-muted-foreground shadow-[0_18px_45px_-30px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <PackageCheck className="h-4 w-4 text-emerald-500" />
        {label}
      </div>
    </div>
  );
}

function ReleaseBackdrop({ scene }: { scene: SceneName }) {
  const accentMap: Record<SceneName, string> = {
    hero: "from-emerald-500/22 via-cyan-400/12 to-amber-400/12",
    "portable-mode": "from-emerald-500/22 via-lime-400/12 to-cyan-400/12",
    "instagram-reliability": "from-rose-400/18 via-amber-300/12 to-cyan-400/10",
    "archive-contact-sheets": "from-cyan-400/16 via-emerald-400/14 to-sky-400/12",
  };

  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.09),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_30%)]" />
      <div className="absolute left-[-120px] top-[-160px] h-[460px] w-[460px] rounded-full bg-emerald-400/18 blur-[110px]" />
      <div className="absolute right-[-140px] top-[120px] h-[420px] w-[420px] rounded-full bg-cyan-400/14 blur-[120px]" />
      <div className="absolute bottom-[-220px] left-[30%] h-[420px] w-[560px] rounded-full bg-amber-300/10 blur-[135px]" />
      <div className={cn("absolute inset-0 bg-gradient-to-br", accentMap[scene])} />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.22) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </>
  );
}

function SceneVisual({ scene }: { scene: SceneName }) {
  switch (scene) {
    case "portable-mode":
      return <PortableScene />;
    case "instagram-reliability":
      return <InstagramScene />;
    case "archive-contact-sheets":
      return <ArchiveScene />;
    case "hero":
    default:
      return <HeroScene />;
  }
}

function Surface({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        "rounded-[34px] border border-white/10 bg-card/78 shadow-[0_40px_110px_-50px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function MiniChip({
  icon: Icon,
  text,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone?: "default" | "good";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold",
        tone === "good"
          ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-500"
          : "border-border/70 bg-background/60 text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {text}
    </div>
  );
}

function SidebarRail() {
  return (
    <div className="w-[94px] border-r border-border/70 bg-background/45 px-4 py-5">
      <div className="space-y-3">
        {["D", "P", "T", "H", "S"].map((label, index) => (
          <div
            key={label}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border text-sm font-bold",
              index === 2
                ? "border-emerald-400/35 bg-emerald-400/14 text-emerald-500"
                : "border-border/70 bg-card/70 text-muted-foreground"
            )}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroScene() {
  return (
    <div className="grid grid-cols-[1.05fr_0.95fr] gap-6">
      <Surface className="overflow-hidden">
        <div className="flex min-h-[620px]">
          <SidebarRail />
          <div className="flex-1 px-7 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Downloads
                </div>
                <div className="mt-2 text-[34px] font-semibold tracking-[-0.04em]">Latest results</div>
              </div>
              <MiniChip icon={PackageCheck} text="Portable aware" tone="good" />
            </div>
            <div className="mt-6 space-y-4">
              <ResultCard
                title="Instagram carousel export"
                meta={["8 files", "48.2 MB", "Saved", "Metadata"]}
                latest
              />
              <ResultCard
                title="Portable setup sanity check"
                meta={["yt-dlp", "ffmpeg", "aria2", "deno"]}
              />
              <ResultCard
                title="Lecture highlights contact sheet"
                meta={["Contact sheet", "Duration", "Archive"]}
              />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <MetricCard label="Modes" value="Full · Lite · Portable" />
              <MetricCard label="Update flow" value="Verified or release-page" />
              <MetricCard label="Results" value="Archive + previews" />
            </div>
          </div>
        </div>
      </Surface>
      <div className="space-y-6">
        <Surface className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Release lanes
              </div>
              <div className="mt-2 text-[31px] font-semibold tracking-[-0.04em]">Choose your fit</div>
            </div>
            <WandSparkles className="h-6 w-6 text-emerald-500" />
          </div>
          <div className="mt-6 space-y-4">
            <ModeRow icon={HardDriveDownload} name="Full" note="Recommended for most users" />
            <ModeRow icon={Boxes} name="Lite" note="Bring your own tools" />
            <ModeRow icon={PackageCheck} name="Portable" note="App and tools beside the EXE" highlight />
          </div>
        </Surface>
        <Surface className="p-6">
          <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            What changed
          </div>
          <div className="mt-5 space-y-3">
            <FeatureRow icon={PackageCheck} title="Portable build" body="Bundled binaries, portable-data layout, manual release-page updates." />
            <FeatureRow icon={Camera} title="Stronger fallbacks" body="Instagram and DownloadGram recovery paths are less brittle." />
            <FeatureRow icon={FolderArchive} title="Richer finished jobs" body="Archive, thumbnails, metadata, and contact-sheet support land together." />
          </div>
        </Surface>
      </div>
    </div>
  );
}

function PortableScene() {
  return (
    <div className="space-y-6">
      <Surface className="overflow-hidden">
        <div className="grid min-h-[400px] grid-cols-[0.88fr_1.12fr]">
          <div className="border-r border-border/70 bg-background/42 px-7 py-6">
            <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Portable package
            </div>
            <div className="mt-4 space-y-4">
              <FolderTree />
            </div>
          </div>
          <div className="px-7 py-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  About and updates
                </div>
                <div className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">
                  Portable builds update manually from GitHub Releases.
                </div>
              </div>
              <MiniChip icon={ShieldCheck} text="Portable ZIP" tone="good" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <InfoPill label="Installer type" value="Portable ZIP" />
              <InfoPill label="Install scope" value="portable-data" />
              <InfoPill label="Managed tools" value="yt-dlp · ffmpeg · aria2 · deno" />
              <InfoPill label="Update action" value="Open Releases page" />
            </div>
            <div className="mt-6 flex gap-3">
              <ActionButton primary icon={ArrowUpRight} label="Open GitHub Releases" />
              <ActionButton icon={PackageCheck} label="Portable tools detected" />
            </div>
          </div>
        </div>
      </Surface>
      <div className="grid grid-cols-3 gap-4">
        <StatPanel icon={PackageCheck} title="Fixed startup probe" body="Portable mode now checks bundled files directly in portable-data/bin." />
        <StatPanel icon={HardDriveDownload} title="No AppData dependency" body="Portable state and managed binaries stay beside the executable." />
        <StatPanel icon={ShieldCheck} title="Safer updates" body="Release-page updates replace the older staged updater path." />
      </div>
    </div>
  );
}

function InstagramScene() {
  return (
    <div className="grid grid-cols-[1.02fr_0.98fr] gap-6">
      <Surface className="overflow-hidden">
        <div className="px-7 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Fallback preview
              </div>
              <div className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">
                Better image-first recovery when the main scrape gets messy
              </div>
            </div>
            <MiniChip icon={Camera} text="Fallback improved" tone="good" />
          </div>
          <div className="mt-6 grid grid-cols-[1.1fr_0.9fr] gap-5">
            <div className="rounded-[28px] border border-border/70 bg-background/55 p-4">
              <div className="rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,#f9a8d4_0%,#fb7185_36%,#f59e0b_68%,#22d3ee_100%)] p-5 text-white shadow-[0_30px_70px_-36px_rgba(244,114,182,0.75)]">
                <div className="flex items-center justify-between">
                  <div className="text-[14px] font-semibold uppercase tracking-[0.22em] text-white/80">Instagram</div>
                  <MiniChip icon={ImageIcon} text="Carousel" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="aspect-[4/5] rounded-[20px] bg-white/20 ring-1 ring-white/30 backdrop-blur-md" />
                  ))}
                </div>
                <div className="mt-4 text-[18px] font-semibold tracking-[-0.02em]">Downloaded images can feed local previews instead of waiting for flaky remote metadata.</div>
              </div>
            </div>
            <div className="space-y-4">
              <FeatureRow icon={Download} title="Stricter link parsing" body="Odd share URLs and fallback links are normalized more carefully before request time." />
              <FeatureRow icon={ImageIcon} title="Better thumbnail paths" body="Image-heavy jobs can reuse downloaded local media as a cleaner preview source." />
              <FeatureRow icon={Layers3} title="Richer finished metadata" body="Completed results keep more context for cards, previews, and later browsing." />
            </div>
          </div>
        </div>
      </Surface>
      <Surface className="p-6">
        <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Reliability pass
        </div>
        <div className="mt-4 space-y-4">
          <ProbeRow title="DownloadGram URL normalization" detail="Cleaner path extraction and fewer bad share-link assumptions." />
          <ProbeRow title="Fallback media fetch selection" detail="More resilient handling for image-only and carousel cases." />
          <ProbeRow title="Thumbnail and preview handoff" detail="Finished cards can lean on local outputs when they exist." />
          <ProbeRow title="Result card context" detail="Output parsing and metadata capture widened for post-download clarity." />
        </div>
      </Surface>
    </div>
  );
}

function ArchiveScene() {
  return (
    <div className="space-y-6">
      <Surface className="overflow-hidden">
        <div className="grid min-h-[430px] grid-cols-[0.94fr_1.06fr]">
          <div className="border-r border-border/70 bg-background/48 px-7 py-6">
            <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Archive browser
            </div>
            <div className="mt-5 space-y-4">
              <ArchiveRow title="Instagram carousel export" note="8 files · preview grid · metadata saved" />
              <ArchiveRow title="Lecture highlights clip" note="Video + subtitles · duration tracked" />
              <ArchiveRow title="Recipe image set" note="Image-only job · contact sheet available" />
            </div>
          </div>
          <div className="px-7 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Result detail
                </div>
                <div className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">
                  Archive, metadata, and contact-sheet style browsing all in one pass
                </div>
              </div>
              <MiniChip icon={Archive} text="Richer results" tone="good" />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <SnapshotTile label="Archive" icon={FolderArchive} />
              <SnapshotTile label="Metadata" icon={FolderKanban} />
              <SnapshotTile label="Contact sheet" icon={Layers3} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <InfoPill label="Stored context" value="thumbnail · size · source · outputs" />
              <InfoPill label="Image-heavy jobs" value="better browsing after download" />
              <InfoPill label="History flow" value="finished cards stay more informative" />
              <InfoPill label="Archive path" value="portable aware and state aware" />
            </div>
          </div>
        </div>
      </Surface>
      <div className="grid grid-cols-3 gap-4">
        <StatPanel icon={FolderArchive} title="Dedicated archive" body="A clearer place to track what finished and what context belongs with it." />
        <StatPanel icon={ImageIcon} title="Better previews" body="Thumbnail and output context make image-heavy jobs easier to scan later." />
        <StatPanel icon={Layers3} title="Contact-sheet support" body="A stronger visual browsing path for multi-image outputs." />
      </div>
    </div>
  );
}

function ResultCard({
  title,
  meta,
  latest = false,
}: {
  title: string;
  meta: string[];
  latest?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border p-4 shadow-[0_24px_55px_-40px_rgba(0,0,0,0.4)]",
        latest
          ? "border-emerald-400/35 bg-emerald-400/10"
          : "border-border/70 bg-card/72"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="h-[84px] w-[120px] rounded-[20px] bg-[linear-gradient(135deg,rgba(16,185,129,0.35),rgba(14,165,233,0.22),rgba(251,191,36,0.22))] ring-1 ring-white/15" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-[23px] font-semibold tracking-[-0.03em]">{title}</div>
            {latest ? (
              <div className="rounded-full bg-emerald-500 px-3 py-1 text-[12px] font-black uppercase tracking-[0.2em] text-emerald-950">
                Latest
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {meta.map((item) => (
              <MiniChip key={item} icon={Layers3} text={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-card/72 p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-[19px] font-semibold leading-[1.3] tracking-[-0.02em]">{value}</div>
    </div>
  );
}

function ModeRow({
  icon: Icon,
  name,
  note,
  highlight = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-[26px] border px-4 py-4",
        highlight
          ? "border-emerald-400/35 bg-emerald-400/12"
          : "border-border/70 bg-background/60"
      )}
    >
      <div
        className={cn(
          "rounded-2xl p-3",
          highlight ? "bg-emerald-500 text-emerald-950" : "bg-card text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-[20px] font-semibold tracking-[-0.03em]">{name}</div>
        <div className="text-[15px] text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[26px] border border-border/70 bg-card/72 p-4">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-emerald-400/12 p-3 text-emerald-500">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[19px] font-semibold tracking-[-0.03em]">{title}</div>
          <div className="mt-1 text-[15px] leading-[1.45] text-muted-foreground">{body}</div>
        </div>
      </div>
    </div>
  );
}

function FolderTree() {
  const rows = [
    ["HalalDL.exe", "app shell"],
    ["HalalDL.portable.json", "portable marker"],
    ["portable-data/", "portable state root"],
    ["portable-data/bin/yt-dlp.exe", "bundled"],
    ["portable-data/bin/ffmpeg.exe", "bundled"],
    ["portable-data/bin/aria2c.exe", "bundled"],
    ["portable-data/state/", "settings + history"],
    ["portable-data/thumbnails/", "preview cache"],
  ];

  return (
    <div className="rounded-[28px] border border-border/70 bg-card/72 p-4">
      {rows.map(([path, note], index) => (
        <div
          key={path}
          className={cn(
            "flex items-center justify-between py-3",
            index !== rows.length - 1 ? "border-b border-border/50" : ""
          )}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-500">
              {path.endsWith("/") ? <FolderArchive className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
            </div>
            <div className="text-[16px] font-medium">{path}</div>
          </div>
          <div className="text-[14px] text-muted-foreground">{note}</div>
        </div>
      ))}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-border/70 bg-card/72 p-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[18px] font-semibold leading-[1.35] tracking-[-0.02em]">{value}</div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  primary = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-3 text-[15px] font-semibold",
        primary
          ? "bg-emerald-500 text-emerald-950 shadow-[0_20px_55px_-28px_rgba(16,185,129,0.9)]"
          : "border border-border/70 bg-card/72 text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </div>
  );
}

function StatPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Surface className="p-5">
      <div className="rounded-2xl bg-emerald-400/12 p-3 text-emerald-500 w-fit">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-[20px] font-semibold tracking-[-0.03em]">{title}</div>
      <div className="mt-2 text-[15px] leading-[1.5] text-muted-foreground">{body}</div>
    </Surface>
  );
}

function ProbeRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[26px] border border-border/70 bg-card/72 p-4">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 rounded-2xl bg-rose-400/12 p-3 text-rose-500">
          <Camera className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[18px] font-semibold tracking-[-0.03em]">{title}</div>
          <div className="mt-1 text-[15px] leading-[1.45] text-muted-foreground">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function ArchiveRow({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-[28px] border border-border/70 bg-card/72 p-4">
      <div className="flex items-center gap-4">
        <div className="grid h-[74px] w-[104px] grid-cols-2 gap-2 rounded-[20px] bg-background/70 p-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-[12px] bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(14,165,233,0.18),rgba(245,158,11,0.18))]" />
          ))}
        </div>
        <div className="flex-1">
          <div className="text-[20px] font-semibold tracking-[-0.03em]">{title}</div>
          <div className="mt-1 text-[15px] text-muted-foreground">{note}</div>
        </div>
        <MiniChip icon={Archive} text="Saved" tone="good" />
      </div>
    </div>
  );
}

function SnapshotTile({
  label,
  icon: Icon,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[26px] border border-border/70 bg-background/55 p-4">
      <div className="aspect-[1.1] rounded-[22px] bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(14,165,233,0.14),rgba(245,158,11,0.12))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex h-full items-end justify-between">
          <div className="rounded-2xl bg-card/80 p-3 text-emerald-500">
            <Icon className="h-5 w-5" />
          </div>
          <div className="rounded-full border border-border/60 bg-card/76 px-3 py-1.5 text-[13px] font-semibold text-muted-foreground">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReleasePromoBoard() {
  const { theme, scene } = useReleaseQuery();
  return <SceneShell theme={theme} scene={scene} />;
}
