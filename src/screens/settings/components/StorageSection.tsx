import { HardDrive, FolderOpen, FolderCog, Search } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { MotionButton } from "@/components/motion/MotionButton";
import { open } from "@tauri-apps/plugin-dialog";

interface StorageSectionProps {
  defaultDownloadDir: string;
  onDirectoryChange: (dir: string) => void;
  tempDir: string;
  onTempDirChange: (dir: string) => void;
}

export function StorageSection({ defaultDownloadDir, onDirectoryChange, tempDir, onTempDirChange }: StorageSectionProps) {
  return (
    <FadeInItem>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage
          </CardTitle>
          <CardDescription>Where your downloads and temporary files are saved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
              Download Directory
            </Label>
            <p className="text-sm text-muted-foreground">Where completed downloads are saved by default.</p>
            <div className="flex gap-2">
              <Input 
                value={defaultDownloadDir || ""} 
                readOnly 
                placeholder="Select a folder..."
                className="bg-muted"
              />
              <MotionButton 
                variant="outline" 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                  });
                  if (selected && !Array.isArray(selected)) {
                    onDirectoryChange(selected);
                  }
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                Browse
              </MotionButton>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderCog className="w-3.5 h-3.5 text-muted-foreground" />
              Temporary Directory
            </Label>
            <p className="text-sm text-muted-foreground">Where in-progress downloads are stored. Leave empty to use the system default.</p>
            <div className="flex gap-2">
              <Input 
                value={tempDir || ""} 
                readOnly 
                placeholder="System default"
                className="bg-muted"
              />
              <MotionButton 
                variant="outline" 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                  });
                  if (selected && !Array.isArray(selected)) {
                    onTempDirChange(selected);
                  }
                }}
              >
                <Search className="w-4 h-4 mr-2" />
                Browse
              </MotionButton>
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeInItem>
  );
}
