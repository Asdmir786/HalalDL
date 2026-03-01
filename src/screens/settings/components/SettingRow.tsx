import { type LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

interface SettingRowProps {
  icon: LucideIcon;
  label: string;
  description: string;
  children: React.ReactNode;
  vertical?: boolean;
}

export function SettingRow({ icon: Icon, label, description, children, vertical }: SettingRowProps) {
  return (
    <div className="group flex items-center justify-between gap-4 rounded-xl border border-border/30 bg-muted/15 px-4 py-3.5 hover:bg-muted/30 hover:border-border/50 transition-all duration-200">
      {vertical ? (
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/5 text-primary/70 group-hover:bg-primary/10 transition-colors shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <Label className="text-sm font-medium">{label}</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {children}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/5 text-primary/70 group-hover:bg-primary/10 transition-colors shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <Label className="text-sm font-medium">{label}</Label>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="shrink-0">{children}</div>
        </>
      )}
    </div>
  );
}
