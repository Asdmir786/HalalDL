import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type HistoryEntry, useHistoryStore } from "@/store/history";
import { useState } from "react";
import { renameFile } from "@/lib/commands";
import { toast } from "sonner";
import { X, Plus, Tag, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HistoryDetailsProps {
  entry: HistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileExists: boolean | null;
}

export function HistoryDetails({ entry, open, onOpenChange, fileExists }: HistoryDetailsProps) {
  const updateNote = useHistoryStore((s) => s.updateNote);
  const addTag = useHistoryStore((s) => s.addTag);
  const removeTag = useHistoryStore((s) => s.removeTag);
  const setEntries = useHistoryStore((s) => s.setEntries);
  const entries = useHistoryStore((s) => s.entries);

  const [note, setNote] = useState(entry?.notes || "");
  const [tagInput, setTagInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFilename, setNewFilename] = useState(entry?.outputPath ? entry.outputPath.split(/[\\/]/).pop() || "" : "");

  if (!entry) return null;

  const handleSaveNote = () => {
    updateNote(entry.id, note);
    toast.success("Note saved");
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    if (entry.tags?.includes(tagInput.trim())) {
      setTagInput("");
      return;
    }
    addTag(entry.id, tagInput.trim());
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    removeTag(entry.id, tag);
  };

  const handleRename = async () => {
    if (!entry.outputPath || !newFilename.trim()) return;
    
    // Construct new path
    const parts = entry.outputPath.split(/[\\/]/);
    parts.pop();
    const newPath = [...parts, newFilename].join(entry.outputPath.includes("\\") ? "\\" : "/");

    if (newPath === entry.outputPath) {
      setIsRenaming(false);
      return;
    }

    try {
      await renameFile(entry.outputPath, newPath);
      
      // Update entry in store
      setEntries(entries.map(e => e.id === entry.id ? { ...e, outputPath: newPath } : e));
      
      toast.success("File renamed");
      setIsRenaming(false);
    } catch (e) {
      toast.error("Failed to rename file");
      console.error(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Details</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Metadata Column */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Title</Label>
              <p className="font-medium text-sm mt-1">{entry.title}</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Filename</Label>
              {isRenaming ? (
                <div className="flex gap-2 mt-1">
                  <Input 
                    value={newFilename} 
                    onChange={(e) => setNewFilename(e.target.value)} 
                    className="h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleRename}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-1 group">
                  <p className="text-sm font-mono break-all">
                    {entry.outputPath ? entry.outputPath.split(/[\\/]/).pop() : "N/A"}
                  </p>
                  {entry.outputPath && fileExists && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setIsRenaming(true)}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Size</Label>
                <p className="text-sm mt-1">{entry.fileSize ? `${(entry.fileSize / 1024 / 1024).toFixed(2)} MB` : "Unknown"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
                <p className="text-sm mt-1">{new Date(entry.downloadedAt).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Format</Label>
                <p className="text-sm mt-1 uppercase">{entry.format || "Unknown"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Domain</Label>
                <p className="text-sm mt-1">{entry.domain}</p>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Path</Label>
              <p className="text-xs font-mono text-muted-foreground mt-1 break-all bg-muted/50 p-2 rounded">
                {entry.outputPath || "N/A"}
              </p>
            </div>
          </div>

          {/* Notes & Tags Column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</Label>
              <textarea 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="Add personal notes here..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={handleSaveNote}
              />
              <p className="text-[10px] text-muted-foreground text-right">Auto-saved on blur</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {entry.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-0.5 h-6">
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    placeholder="Add tag..."
                    className="h-8 text-sm pl-8"
                  />
                </div>
                <Button size="sm" variant="secondary" onClick={handleAddTag} disabled={!tagInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
           <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
