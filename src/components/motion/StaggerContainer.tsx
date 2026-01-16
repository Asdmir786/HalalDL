
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export const FadeInStagger = ({
  children,
  className,
  stagger = 0.05,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const FadeInItem = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
