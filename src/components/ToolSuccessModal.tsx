import { useToolsStore } from "@/store/tools";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { CheckCircle2, Sparkles, PartyPopper, ArrowRight } from "lucide-react";

export function ToolSuccessModal() {
  const { tools, discoveredToolId, setDiscoveredToolId } = useToolsStore();
  const tool = tools.find((t) => t.id === discoveredToolId);
  const pendingCongratsKey = "halaldl:pendingToolCongrats";

  if (!tool) return null;

  const popNextToolId = (): string | null => {
    try {
      const raw = localStorage.getItem(pendingCongratsKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const queue: string[] = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
      const remaining: string[] = [];
      let next: string | null = null;
      for (const id of queue) {
        if (!next && tools.some((t) => t.id === id)) next = id;
        else remaining.push(id);
      }
      if (remaining.length === 0) localStorage.removeItem(pendingCongratsKey);
      else localStorage.setItem(pendingCongratsKey, JSON.stringify(remaining));
      return next;
    } catch {
      return null;
    }
  };

  const closeAndMaybeShowNext = () => {
    setDiscoveredToolId(null);
    const next = popNextToolId();
    if (next) setTimeout(() => setDiscoveredToolId(next), 50);
  };

  return (
    <Dialog open={!!discoveredToolId} onOpenChange={() => closeAndMaybeShowNext()}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none bg-transparent shadow-2xl">
        <div className="relative">
          {/* Animated Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background animate-gradient-slow bg-[length:200%_200%]" />
          
          <div className="relative p-8 flex flex-col items-center text-center space-y-6">
            {/* Success Icon with Glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
              <div className="relative bg-primary/10 p-4 rounded-full border border-primary/20">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500 animate-bounce" />
              <PartyPopper className="absolute -bottom-2 -left-2 w-6 h-6 text-primary animate-bounce delay-75" />
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Congratulations!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-base">
                We've successfully detected and verified <span className="text-foreground font-bold">{tool.name}</span> on your system.
              </DialogDescription>
            </div>

            <div className="w-full bg-muted/30 rounded-xl p-4 border border-muted/50 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Version</span>
                <span className="font-mono font-medium">{tool.version || "Unknown"}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Status</span>
                <span className="flex items-center gap-2 text-green-500 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Ready to go
                </span>
              </div>
            </div>

            <MotionButton 
              type="button"
              onClick={() => closeAndMaybeShowNext()}
              className="w-full h-12 text-base font-bold group bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
            >
              Start Downloading
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </MotionButton>
            
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Your environment is fully optimized
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
