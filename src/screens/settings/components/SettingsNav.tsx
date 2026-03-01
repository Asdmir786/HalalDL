import { useEffect, useState } from "react";
import {
  Palette, HardDrive, Bell, Gauge, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "behavior", label: "Behavior", icon: Bell },
  { id: "engine", label: "Engine", icon: Gauge },
  { id: "about", label: "About", icon: Info },
];

interface SettingsNavProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

export function SettingsNav({ scrollContainerRef }: SettingsNavProps) {
  const [activeId, setActiveId] = useState("appearance");

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = NAV_ITEMS.map((item) => ({
        id: item.id,
        el: container.querySelector(`#${item.id}`),
      })).filter((s) => s.el);

      if (sections.length === 0) return;

      const containerRect = container.getBoundingClientRect();
      const threshold = 120;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        const rect = (section.el as HTMLElement).getBoundingClientRect();
        const relativeTop = rect.top - containerRect.top;
        if (relativeTop <= threshold) {
          setActiveId(section.id);
          return;
        }
      }
      setActiveId(sections[0].id);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef]);

  const scrollTo = (id: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`#${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      {/* Desktop: vertical sticky nav */}
      <nav className="hidden md:flex flex-col gap-1 sticky top-0 pt-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 text-left cursor-pointer",
                isActive
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Mobile: horizontal scroll pills */}
      <div className="flex md:hidden gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-3 h-3" />
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
