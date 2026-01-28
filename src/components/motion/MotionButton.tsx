import { motion, HTMLMotionProps } from "framer-motion";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type MotionButtonProps = ButtonProps & HTMLMotionProps<"button">;

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, children, disabled, ...props }, ref) => {
    const canAnimate = !disabled;
    return (
      <Button
        ref={ref}
        asChild
        className={cn("relative overflow-hidden", className)}
        disabled={disabled}
        {...props}
      >
        <motion.button
          disabled={disabled}
          whileHover={canAnimate ? { scale: 1.02 } : undefined}
          whileTap={canAnimate ? { scale: 0.95 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          {children}
        </motion.button>
      </Button>
    );
  }
);
MotionButton.displayName = "MotionButton";

export const ActionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, children, disabled, ...props }, ref) => {
    const canAnimate = !disabled;
    return (
      <motion.button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none",
          "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
          className
        )}
        disabled={disabled}
        whileHover={canAnimate ? { scale: 1.05 } : undefined}
        whileTap={canAnimate ? { scale: 0.95 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
ActionButton.displayName = "ActionButton";
