import { cn } from "@/lib/utils";
import logoForLightBackground from "@/assets/brand/halaldl-symbol-light-background.png";
import logoForDarkBackground from "@/assets/brand/halaldl-symbol-dark-background.png";

type BrandLogoProps = {
  className?: string;
  alt?: string;
};

/** Theme-aware HalalDL mark. Never recolors with user accent themes. */
export function BrandLogo({ className, alt = "HalalDL" }: BrandLogoProps) {
  return (
    <span className={cn("relative inline-flex shrink-0 overflow-hidden", className)}>
      <img
        src={logoForLightBackground}
        alt={alt}
        draggable={false}
        className="h-full w-full object-contain dark:hidden"
      />
      <img
        src={logoForDarkBackground}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
