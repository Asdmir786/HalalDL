import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAttentionStore } from "@/store/attention";

interface SettingsSectionProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function SettingsSection({ id, icon: Icon, title, description, children, defaultOpen = true }: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const attentionTarget = useAttentionStore((state) => state.target);
  const clearAttentionTarget = useAttentionStore((state) => state.clearTarget);
  const [spotlightToken, setSpotlightToken] = useState<number | null>(null);

  useEffect(() => {
    if (
      !attentionTarget ||
      attentionTarget.screen !== "settings" ||
      attentionTarget.targetType !== "section" ||
      attentionTarget.targetId !== id
    ) {
      return;
    }

    setOpen(true);
    setSpotlightToken(attentionTarget.token);

    const raf = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    clearAttentionTarget(attentionTarget.token);

    const timeout = window.setTimeout(() => {
      setSpotlightToken((current) => (current === attentionTarget.token ? null : current));
    }, 4200);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
    };
  }, [attentionTarget, clearAttentionTarget, id]);

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-8 rounded-2xl transition-all duration-500",
        spotlightToken !== null &&
          "bg-primary/[0.05] px-3 shadow-[0_0_0_1px_rgba(99,102,241,0.14),0_16px_42px_rgba(59,130,246,0.10)]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-3 py-3 px-1 cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/8 text-primary group-hover:bg-primary/12 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 pb-2 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
