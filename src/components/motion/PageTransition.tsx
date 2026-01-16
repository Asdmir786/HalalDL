
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
    filter: "blur(4px)",
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    filter: "blur(4px)",
  },
};

const pageTransition = {
  type: "tween" as const,
  ease: "anticipate" as const,
  duration: 0.4,
};

export const PageTransition = ({ children, className }: PageTransitionProps) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
      style={{ height: "100%", width: "100%" }}
    >
      {children}
    </motion.div>
  );
};
