
import { motion } from "framer-motion";

export const StaggeredList = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <motion.div
    initial="hidden"
    animate="show"
    className={className}
    variants={{
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: {
          staggerChildren: 0.05
        }
      }
    }}
  >
    {children}
  </motion.div>
);

export const ListItem = ({ children, className }: { children: React.ReactNode, className?: string, index?: number }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, x: -10 },
      show: { opacity: 1, x: 0 }
    }}
    transition={{ duration: 0.2 }}
    className={className}
    layout
  >
    {children}
  </motion.div>
);
