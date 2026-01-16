import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Preset } from "@/store/presets";

interface PresetEditorProps {
  preset: Preset | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: Partial<Preset>) => void;
}

export function PresetEditor({ preset, isOpen, onClose, onSave }: PresetEditorProps) {
  const [name, setName] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [args, setArgs] = useState(preset ? preset.args.join(" ") : "");

  const handleSave = () => {
    onSave({
      name,
      description,
      args: args.split(" ").filter(a => a.trim() !== ""),
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] glass border border-white/10">
        <DialogHeader>
          <DialogTitle>{preset?.id ? "Edit Preset" : "New Preset"}</DialogTitle>
          <DialogDescription>
            Configure your custom yt-dlp arguments here.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="My Custom Preset"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Input 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Extract audio as FLAC..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="args">Arguments (yt-dlp flags)</Label>
            <Input 
              id="args" 
              value={args} 
              onChange={(e) => setArgs(e.target.value)} 
              placeholder="-f bestvideo+bestaudio --merge-output-format mp4"
              className="font-mono text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <MotionButton type="button" variant="outline" onClick={onClose}>
            Cancel
          </MotionButton>
          <MotionButton type="button" onClick={handleSave}>
            Save Changes
          </MotionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
