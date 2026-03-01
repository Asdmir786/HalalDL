import { Save, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionButton } from "@/components/motion/MotionButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SaveBarProps {
  isDirty: boolean;
  onSave: () => void;
  onResetAll: () => void;
  onResetGroup: (group: "appearance" | "storage" | "behavior" | "downloadEngine") => void;
}

export function SaveBar({ isDirty, onSave, onResetAll, onResetGroup }: SaveBarProps) {
  return (
    <AnimatePresence>
      {isDirty && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="absolute bottom-0 left-0 right-0 z-20 border-t border-border/30 bg-background/80 backdrop-blur-xl px-8 py-3"
        >
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium text-muted-foreground">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <MotionButton
                    variant="ghost"
                    size="sm"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Reset
                  </MotionButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onResetAll}>Reset all</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onResetGroup("appearance")}>Reset appearance</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResetGroup("storage")}>Reset storage</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResetGroup("behavior")}>Reset behavior</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onResetGroup("downloadEngine")}>Reset download engine</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <MotionButton
                onClick={onSave}
                size="sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-primary text-primary-foreground shadow-md shadow-primary/20"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save Changes
              </MotionButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
