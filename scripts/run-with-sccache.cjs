#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

function findSccache() {
  const detector = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(detector, ["sccache"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status === 0) {
    const first = String(result.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0];
    if (first) return first;
  }

  const home = os.homedir();
  const candidatePaths = process.platform === "win32"
    ? [path.join(home, ".cargo", "bin", "sccache.exe")]
    : [path.join(home, ".cargo", "bin", "sccache")];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      void 0;
    }
  }

  return null;
}

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/run-with-sccache.cjs <command> [...args]");
  process.exit(1);
}

const env = { ...process.env };
const sccachePath = findSccache();
if (sccachePath) {
  env.RUSTC_WRAPPER = sccachePath;
  const binDir = path.dirname(sccachePath);
  const currentPath = env.PATH ?? env.Path ?? "";
  const nextPath = `${binDir}${path.delimiter}${currentPath}`;
  env.PATH = nextPath;
  env.Path = nextPath;
}

const child = spawn(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    if (process.platform === "win32") {
      // Windows signal forwarding is limited; use non-zero exit for interrupted child.
      process.exit(1);
    }
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

