export type DiagnosticsSummaryMode = "FULL" | "LITE" | "PORTABLE";

export type DiagnosticsSummaryTool = {
  name: string;
  status: string;
  version?: string;
};

export type DiagnosticsPackageType = "msi" | "nsis" | "portable" | "unknown";

export type DiagnosticsSummaryInput = {
  version: string;
  mode: DiagnosticsSummaryMode;
  packageLabel: string;
  osLabel: string;
  activeDownloadCount: number;
  history: {
    total: number;
    completed: number;
    failed: number;
  };
  tools: DiagnosticsSummaryTool[];
  recentErrors: string[];
};

function formatMode(mode: DiagnosticsSummaryMode): string {
  if (mode === "FULL") return "Full";
  if (mode === "PORTABLE") return "Portable";
  return "Lite";
}

export function formatDiagnosticsPackageLabel(
  packageType: DiagnosticsPackageType
): string {
  if (packageType === "msi") return "MSI";
  if (packageType === "nsis") return "NSIS";
  if (packageType === "portable") return "Portable ZIP";
  return "Package Unknown";
}

function formatTool(tool: DiagnosticsSummaryTool): string {
  const version = tool.version?.trim();
  return version
    ? `- ${tool.name}: ${tool.status}, ${version}`
    : `- ${tool.name}: ${tool.status}`;
}

function formatRecentErrors(errors: string[]): string {
  if (errors.length === 0) return "- No recent errors";
  return errors.map((error) => `- ${error}`).join("\n");
}

export function formatDiagnosticsSummary(input: DiagnosticsSummaryInput): string {
  const tools =
    input.tools.length > 0
      ? input.tools.map(formatTool).join("\n")
      : "- No tools loaded";

  return [
    "HalalDL diagnostics",
    `Version: ${input.version}`,
    `Mode: ${formatMode(input.mode)}`,
    `Package: ${input.packageLabel}`,
    `OS: ${input.osLabel}`,
    `Active downloads: ${input.activeDownloadCount}`,
    `History: ${input.history.total} total, ${input.history.completed} completed, ${input.history.failed} failed`,
    "",
    "Tools:",
    tools,
    "",
    "Recent errors:",
    formatRecentErrors(input.recentErrors),
  ].join("\n");
}
