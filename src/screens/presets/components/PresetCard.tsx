import { 
  Copy, 
  Trash2, 
  FileEdit, 
  Lock
} from "lucide-react";
import { toast } from "sonner";
import { MotionButton } from "@/components/motion/MotionButton";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Preset } from "@/store/presets";

interface PresetCardProps {
  preset: Preset;
  onDuplicate: (id: string) => void;
  onEdit: (preset: Preset) => void;
  onDelete: (id: string) => void;
}

export function PresetCard({ preset, onDuplicate, onEdit, onDelete }: PresetCardProps) {
  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-200 border-muted/60 overflow-hidden glass-card">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1.5 min-w-0 flex-1">
            <CardTitle className="text-base font-bold leading-snug break-words">{preset.name}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {preset.description}
            </CardDescription>
          </div>
          {preset.isBuiltIn ? (
            <Badge variant="secondary" className="gap-1 shrink-0 bg-secondary/50 text-[10px]">
              <Lock className="w-3 h-3" />
              Built-in
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">User</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="bg-muted/30 p-3 rounded-lg border border-muted/50 font-mono text-[10px] text-muted-foreground break-words relative group max-h-24 overflow-y-auto">
           <div className="line-clamp-4">
              yt-dlp {preset.args.join(" ")}
           </div>
           <MotionButton 
             variant="ghost" 
             size="icon" 
             className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
             onClick={() => {
                navigator.clipboard.writeText(`yt-dlp ${preset.args.join(" ")}`);
                toast.success("Command copied to clipboard");
             }}
           >
              <Copy className="w-3 h-3" />
           </MotionButton>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 border-t p-2 flex gap-2 justify-end">
        <MotionButton 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs px-2"
          onClick={() => {
            onDuplicate(preset.id);
            toast.success(`Duplicated ${preset.name}`);
          }}
        >
          <Copy className="w-3.5 h-3.5 mr-1.5" />
          Duplicate
        </MotionButton>
        {!preset.isBuiltIn && (
          <>
            <MotionButton 
              variant="ghost" 
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => onEdit(preset)}
            >
              <FileEdit className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </MotionButton>
            <MotionButton 
              variant="ghost" 
              size="sm"
              className="h-8 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                onDelete(preset.id);
                toast.error(`Deleted ${preset.name}`);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </MotionButton>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
