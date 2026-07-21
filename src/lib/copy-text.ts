import { toast } from "sonner";

export async function copyText(
  value: string,
  successMessage = "Copied to clipboard"
): Promise<boolean> {
  const text = value.trim();
  if (!text) {
    toast.error("Nothing to copy");
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch (error) {
    toast.error(`Copy failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

export function formatJobErrorText(input: {
  title?: string;
  url?: string;
  statusDetail?: string;
  failReason?: string;
}): string {
  const lines = [
    input.title ? `Title: ${input.title}` : null,
    input.url ? `URL: ${input.url}` : null,
    input.statusDetail ? `Error: ${input.statusDetail}` : null,
    input.failReason && input.failReason !== input.statusDetail
      ? `Reason: ${input.failReason}`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}
