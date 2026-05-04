import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const providerPath = path.join(
  repoRoot,
  "src",
  "lib",
  "media-engine",
  "downloadgram-providers.json"
);
const providers = JSON.parse(await fs.readFile(providerPath, "utf8"));
const sampleUrl =
  process.env.DOWNLOADGRAM_PROBE_URL ||
  "https://www.instagram.com/p/CE4s12lJd1y/";

function encodeForm(provider) {
  const params = new URLSearchParams({
    url: sampleUrl,
    ...(provider.formFields || {}),
    lang: "en",
  });
  return params.toString();
}

function summarize(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function checkProvider(provider) {
  if (provider.enabled === false) {
    return {
      id: provider.id,
      status: "skipped",
      detail: "disabled in provider config",
    };
  }

  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        accept: "*/*",
        origin: provider.origin,
        referer: provider.referer,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
      },
      body: encodeForm(provider),
    });
    const text = await response.text();
    const json = readJson(text);
    const message =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.error === "string"
          ? json.error
          : "";
    const hasHtmlPayload =
      text.includes("innerHTML") ||
      text.includes(".html(") ||
      text.trim().startsWith("<");
    const hasLink = /href\s*=|https?:\/\//i.test(text);
    const routeReachable =
      response.ok ||
      message.toLowerCase().includes("instagram media service");

    return {
      id: provider.id,
      status: response.ok && hasHtmlPayload ? "ok" : routeReachable ? "route-ok" : "attention",
      detail: `HTTP ${response.status}; payload=${hasHtmlPayload ? "html/js" : "json/unknown"}; links=${hasLink ? "yes" : "no"}; ${summarize(text)}`,
    };
  } catch (error) {
    return {
      id: provider.id,
      status: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = [];
for (const provider of providers) {
  results.push(await checkProvider(provider));
}

for (const result of results) {
  console.log(`${result.status.toUpperCase().padEnd(9)} ${result.id} - ${result.detail}`);
}

if (results.every((result) => result.status === "error")) {
  process.exitCode = 1;
}
