export interface ToolBatchItemResult {
  tool: string;
  success: boolean;
  message: string;
}

export interface ToolBatchResult {
  results: ToolBatchItemResult[];
  summary: string;
  allSucceeded: boolean;
}

export function getSuccessfulToolResults(result: ToolBatchResult | null): ToolBatchItemResult[] {
  return result?.results.filter((item) => item.success) ?? [];
}

export function getFailedToolResults(result: ToolBatchResult | null): ToolBatchItemResult[] {
  return result?.results.filter((item) => !item.success) ?? [];
}

export function buildToolBatchErrorMessage(
  result: ToolBatchResult,
  toolNameById: Record<string, string>
): string {
  const failed = getFailedToolResults(result);
  if (failed.length === 0) return result.summary;

  const first = failed[0];
  const toolName = toolNameById[first.tool] ?? first.tool;
  if (failed.length === 1) {
    return `${toolName} failed: ${first.message}`;
  }

  return `${failed.length} tools failed. First issue: ${toolName} — ${first.message}`;
}
