type VersionParts = number[];

function parseVersionParts(input: string): VersionParts | null {
  const dotted = input.match(/\d+(?:\.\d+)+/);
  if (dotted) {
    const parts = dotted[0]
      .split(".")
      .map((x) => Number.parseInt(x, 10))
      .filter((n) => Number.isFinite(n));
    if (parts.length) return parts;
  }
  const dashed = input.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dashed) {
    return [Number(dashed[1]), Number(dashed[2]), Number(dashed[3])];
  }
  const compact = input.match(/(?:^|[^0-9])(20\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/);
  if (compact) {
    return [Number(compact[1]), Number(compact[2]), Number(compact[3])];
  }
  return null;
}

function compareVersionParts(a: VersionParts, b: VersionParts): number {
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function isUpdateAvailable(currentVersion: string | undefined, latestVersion: string | undefined): boolean | undefined {
  if (!currentVersion || !latestVersion) return undefined;
  if (currentVersion.trim() === latestVersion.trim()) return false;
  const currentParts = parseVersionParts(currentVersion);
  const latestParts = parseVersionParts(latestVersion);
  if (currentParts && latestParts) {
    const cmp = compareVersionParts(latestParts, currentParts);
    if (cmp > 0) return true;
    if (cmp < 0) return false;
    if (
      /git/i.test(currentVersion) &&
      /git/i.test(latestVersion) &&
      currentVersion.trim() !== latestVersion.trim()
    ) {
      return true;
    }
    return false;
  }
  if (!currentParts && latestParts) return true;
  return undefined;
}

export async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain,*/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
