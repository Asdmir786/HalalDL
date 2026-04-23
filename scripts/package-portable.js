import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

const tauriConfig = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "src-tauri", "tauri.conf.json"), "utf8")
);
const version = tauriConfig.version;
const productName = tauriConfig.productName;

const outDir = path.join(repoRoot, "out");
const workDir = path.join(repoRoot, ".portable-build");
const stagingDir = path.join(workDir, "staging");
const downloadsDir = path.join(workDir, "downloads");
const appExe = path.join(repoRoot, "src-tauri", "target", "release", `${productName}.exe`);
const assetName = `${productName}-Portable-v${version}-win10+11-x64.zip`;

const USER_AGENT = `HalalDL-PortablePackager/${version}`;

async function main() {
  ensureFile(appExe, "Portable app executable was not built");

  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(downloadsDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  removeExistingPortableAssets(outDir);

  copyFile(appExe, path.join(stagingDir, `${productName}.exe`));
  writePortableMarker(path.join(stagingDir, `${productName}.portable.json`));

  const portableBinDir = path.join(stagingDir, "portable-data", "bin");
  fs.mkdirSync(portableBinDir, { recursive: true });

  await bundlePortableTools(portableBinDir);
  createZipFromDirectory(stagingDir, path.join(outDir, assetName));

  console.log(`✅ Built portable package: out/${assetName}`);
}

function ensureFile(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${message}: ${filePath}`);
  }
}

function removeExistingPortableAssets(dir) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith(`${productName}-Portable-`)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
  }
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function writePortableMarker(markerPath) {
  const payload = {
    portable: true,
    productName,
    version,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(markerPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function bundlePortableTools(portableBinDir) {
  console.log("Bundling portable tools...");
  await downloadToFile(
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
    path.join(portableBinDir, "yt-dlp.exe")
  );

  const ffmpegZip = path.join(downloadsDir, "ffmpeg.zip");
  await downloadToFile(await resolveLatestFfmpegZipUrl(), ffmpegZip);
  extractArchive(ffmpegZip, path.join(downloadsDir, "ffmpeg"));
  copyExtractedFile(path.join(downloadsDir, "ffmpeg"), "ffmpeg.exe", portableBinDir);
  copyExtractedFile(path.join(downloadsDir, "ffmpeg"), "ffprobe.exe", portableBinDir);

  const aria2Zip = path.join(downloadsDir, "aria2.zip");
  await downloadToFile(await resolveLatestAria2ZipUrl(), aria2Zip);
  extractArchive(aria2Zip, path.join(downloadsDir, "aria2"));
  copyExtractedFile(path.join(downloadsDir, "aria2"), "aria2c.exe", portableBinDir);

  const denoZip = path.join(downloadsDir, "deno.zip");
  await downloadToFile(
    "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip",
    denoZip
  );
  extractArchive(denoZip, path.join(downloadsDir, "deno"));
  copyExtractedFile(path.join(downloadsDir, "deno"), "deno.exe", portableBinDir);
}

async function resolveLatestAria2ZipUrl() {
  const release = await fetchJson("https://api.github.com/repos/aria2/aria2/releases/latest");
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const match = assets.find((asset) => {
    const name = String(asset?.name ?? "").toLowerCase();
    return name.endsWith(".zip") && !name.endsWith(".zip.asc") && name.includes("win-64bit");
  });
  if (!match?.browser_download_url) {
    throw new Error("Could not resolve latest aria2 Windows ZIP asset");
  }
  return match.browser_download_url;
}

async function resolveLatestFfmpegZipUrl() {
  try {
    const versionText = await fetchText("https://www.gyan.dev/ffmpeg/builds/release-version");
    const versionTag = versionText.trim().split(/\s+/)[0]?.replace(/^v/, "");
    if (!versionTag) {
      throw new Error("Empty FFmpeg version tag");
    }

    const release = await fetchJson(
      `https://api.github.com/repos/GyanD/codexffmpeg/releases/tags/${versionTag}`
    );
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const match = assets.find((asset) => {
      const name = String(asset?.name ?? "").toLowerCase();
      return name.endsWith(".zip") && name.includes("essentials_build");
    });
    if (match?.browser_download_url) {
      return match.browser_download_url;
    }
  } catch (error) {
    console.warn(`⚠️ Falling back to default FFmpeg ZIP URL: ${String(error)}`);
  }

  return "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function downloadToFile(url, destination) {
  console.log(`Downloading ${path.basename(destination)}...`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.from(arrayBuffer));
}

function extractArchive(zipPath, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${psQuote(zipPath)}' -DestinationPath '${psQuote(destination)}' -Force`,
    ],
    { stdio: "inherit" }
  );
}

function copyExtractedFile(searchRoot, fileName, destinationDir) {
  const match = findFileRecursive(searchRoot, fileName);
  if (!match) {
    throw new Error(`Could not find ${fileName} in ${searchRoot}`);
  }
  copyFile(match, path.join(destinationDir, fileName));
}

function findFileRecursive(root, fileName) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findFileRecursive(fullPath, fileName);
      if (nested) return nested;
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return fullPath;
    }
  }
  return null;
}

function createZipFromDirectory(sourceDir, destinationZip) {
  if (fs.existsSync(destinationZip)) {
    fs.rmSync(destinationZip, { force: true });
  }
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${psQuote(path.join(sourceDir, "*"))}' -DestinationPath '${psQuote(destinationZip)}' -Force`,
    ],
    { stdio: "inherit" }
  );
}

function psQuote(value) {
  return String(value).replace(/'/g, "''");
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
