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
  userAgent: string;
  activeDownloadCount: number;
  history: {
    total: number;
    completed: number;
    failed: number;
  };
  tools: DiagnosticsSummaryTool[];
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
  if (tool.status === "Missing") return `- ${tool.name}: Missing`;
  return version ? `- ${tool.name}: ${version}` : `- ${tool.name}: ${tool.status}`;
}

export function formatDiagnosticsSummary(input: DiagnosticsSummaryInput): string {
  const tools =
    input.tools.length > 0
      ? input.tools.map(formatTool).join("\n")
      : "- No tools loaded";

  return [
    "HalalDL support info",
    `Version: ${input.version}`,
    `Mode: ${formatMode(input.mode)}`,
    `Package: ${input.packageLabel}`,
    `OS: ${input.osLabel}`,
    `User agent: ${input.userAgent}`,
    `Downloads running: ${input.activeDownloadCount}`,
    `History: ${input.history.total} total, ${input.history.completed} completed, ${input.history.failed} failed`,
    "",
    "Tools:",
    tools,
  ].join("\n");
}
