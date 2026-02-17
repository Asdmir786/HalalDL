import { Bell, Clipboard, Trash2, FileWarning } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  fileCollision: FileCollisionAction;
  onFileCollisionChange: (val: FileCollisionAction) => void;
}

export function BehaviorSection({
  notifications, onNotificationsChange,
  autoClearFinished, onAutoClearChange,
  autoCopyFile, onAutoCopyChange,
  fileCollision, onFileCollisionChange
}: BehaviorSectionProps) {
  return (
    <FadeInItem>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Behavior
          </CardTitle>
          <CardDescription>Notifications, clipboard, and file handling preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                Desktop Notifications
              </Label>
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
              <Label className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                Auto-Clear Completed
              </Label>
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
              <Label className="flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5 text-muted-foreground" />
                Auto-Copy File
              </Label>
              <p className="text-sm text-muted-foreground">Copy downloaded file to clipboard when complete.</p>
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
                <FileWarning className="w-3.5 h-3.5 text-yellow-500" />
                File Collision
              </Label>
              <p className="text-sm text-muted-foreground">What to do when a file with the same name already exists.</p>
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
