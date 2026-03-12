import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface GiftAnimationProps {
  emoji: string | null;
  onComplete?: () => void;
}

const GiftAnimation = ({ emoji, onComplete }: GiftAnimationProps) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (emoji) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        onComplete?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [emoji, onComplete]);

  return (
    <AnimatePresence>
      {show && emoji && (
        <motion.div
          initial={{ scale: 0, y: 50, opacity: 0 }}
          animate={{
            scale: [0, 1.5, 1.2],
            y: [50, -20, -10],
            opacity: [0, 1, 1],
          }}
          exit={{ scale: 0, opacity: 0, y: -100 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
        >
          <div className="flex flex-col items-center">
            <span className="text-8xl drop-shadow-lg">{emoji}</span>
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-2 rounded-full gradient-love px-4 py-1.5 shadow-elevated"
            >
              <span className="text-sm font-bold text-primary-foreground">Gift Sent! 🎉</span>
            </motion.div>
          </div>
          {/* Sparkle particles */}
          {[...Array(8)].map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: Math.cos((i * Math.PI * 2) / 8) * 120,
                y: Math.sin((i * Math.PI * 2) / 8) * 120,
              }}
              transition={{ duration: 1, delay: 0.2 }}
              className="absolute text-2xl"
            >
              ✨
            </motion.span>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GiftAnimation;
