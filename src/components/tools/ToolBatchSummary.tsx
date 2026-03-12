import type { ToolBatchResult } from "@/lib/tools/tool-batch";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ToolBatchSummaryProps {
  result: ToolBatchResult;
  toolNameById: Record<string, string>;
}

export function ToolBatchSummary({ result, toolNameById }: ToolBatchSummaryProps) {
  const succeeded = result.results.filter((item) => item.success);
  const failed = result.results.filter((item) => !item.success);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-medium">{result.summary}</div>
      </div>

      {succeeded.length > 0 && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Completed
          </div>
          <div className="space-y-2 text-xs text-foreground/85">
            {succeeded.map((item) => (
              <div key={`${item.tool}-success`} className="flex items-start justify-between gap-3">
                <span>{toolNameById[item.tool] ?? item.tool}</span>
                <span className="max-w-[60%] text-right text-muted-foreground">{item.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {failed.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertCircle className="h-4 w-4" />
            Failed
          </div>
          <div className="space-y-2 text-xs text-destructive/90">
            {failed.map((item) => (
              <div key={`${item.tool}-failed`} className="space-y-1">
                <div className="font-medium">{toolNameById[item.tool] ?? item.tool}</div>
                <div className="text-destructive/80">{item.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
