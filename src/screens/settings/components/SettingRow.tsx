import { type LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  children: React.ReactNode;
  vertical?: boolean;
  disabled?: boolean;
  inset?: boolean;
}

export function SettingRow({ icon: Icon, label, description, children, vertical, disabled, inset }: SettingRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 rounded-xl border border-border/30 bg-muted/15 px-4 py-3.5 transition-all duration-200",
        !disabled && "hover:bg-muted/30 hover:border-border/50",
        disabled && "opacity-60",
        inset && "ml-3 border-dashed"
      )}
      aria-disabled={disabled}
    >
      {vertical ? (
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg bg-primary/5 text-primary/70 transition-colors shrink-0",
              !disabled && "group-hover:bg-primary/10"
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <Label className="text-sm font-medium">{label}</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className={cn(disabled && "pointer-events-none")}>{children}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "p-2 rounded-lg bg-primary/5 text-primary/70 transition-colors shrink-0",
              !disabled && "group-hover:bg-primary/10"
            )}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <Label className="text-sm font-medium">{label}</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className={cn("shrink-0", disabled && "pointer-events-none")}>{children}</div>
        </>
      )}
    </div>
  );
}
