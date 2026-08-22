
import { motion, HTMLMotionProps } from "framer-motion";
import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type MotionButtonProps = ButtonProps & HTMLMotionProps<"button">;

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        asChild
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
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
  ({ className, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          "bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2",
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
ActionButton.displayName = "ActionButton";
