#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");

function hasSccache() {
  const detector = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(detector, ["sccache"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/run-with-sccache.cjs <command> [...args]");
  process.exit(1);
}

const env = { ...process.env };
if (hasSccache()) {
  env.RUSTC_WRAPPER = "sccache";
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

