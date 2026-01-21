import { Zap, Save, FileWarning } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { FileCollisionAction } from "@/store/settings";

interface BehaviorSectionProps {
  notifications: boolean;
  onNotificationsChange: (val: boolean) => void;
  autoClearFinished: boolean;
  onAutoClearChange: (val: boolean) => void;
  autoCopyFile: boolean;
  onAutoCopyChange: (val: boolean) => void;
  paranoidMode: boolean;
  onParanoidModeChange: (val: boolean) => void;
  maxConcurrency: number;
  onMaxConcurrencyChange: (val: number) => void;
  fileCollision: FileCollisionAction;
  onFileCollisionChange: (val: FileCollisionAction) => void;
}

export function BehaviorSection({
  notifications, onNotificationsChange,
  autoClearFinished, onAutoClearChange,
  autoCopyFile, onAutoCopyChange,
  paranoidMode, onParanoidModeChange,
  maxConcurrency, onMaxConcurrencyChange,
  fileCollision, onFileCollisionChange
}: BehaviorSectionProps) {
  return (
    <FadeInItem>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Behavior
          </CardTitle>
          <CardDescription>App notifications and background tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">Show alerts when downloads complete or fail.</p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={onNotificationsChange}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Clear Completed</Label>
              <p className="text-sm text-muted-foreground">Automatically remove finished downloads from the list.</p>
            </div>
            <Switch
              checked={autoClearFinished}
              onCheckedChange={onAutoClearChange}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Copy File</Label>
              <p className="text-sm text-muted-foreground">Automatically copy the downloaded file to clipboard.</p>
            </div>
            <Switch
              checked={autoCopyFile}
              onCheckedChange={onAutoCopyChange}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Save className="w-4 h-4 text-green-500" />
                Paranoid Backup Mode
              </Label>
              <p className="text-sm text-muted-foreground">Automatically backup download history to Documents/HalalDL/backups.</p>
            </div>
            <Switch
              checked={paranoidMode}
              onCheckedChange={onParanoidModeChange}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Max Concurrent Downloads</Label>
              <p className="text-sm text-muted-foreground">
                Limit how many downloads run at the same time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {maxConcurrency}
              </span>
              <Slider
                className="w-40"
                min={1}
                max={8}
                step={1}
                value={[maxConcurrency]}
                onValueChange={([value]) => onMaxConcurrencyChange(value)}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-yellow-500" />
                File Collision
              </Label>
              <p className="text-sm text-muted-foreground">What to do if a file already exists.</p>
            </div>
            <Select 
              value={fileCollision} 
              onValueChange={(v) => onFileCollisionChange(v as FileCollisionAction)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overwrite">Overwrite</SelectItem>
                <SelectItem value="rename">Rename (Auto-increment)</SelectItem>
                <SelectItem value="skip">Skip</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </FadeInItem>
  );
}
