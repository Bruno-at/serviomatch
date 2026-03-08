import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import ProfileCard from "./ProfileCard";
import { profiles } from "@/data/profiles";
import { toast } from "sonner";

const DiscoverView = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const profile = profiles[currentIndex];
      if (direction === "right") {
        toast.success(`You liked ${profile.name}! 💕`, { duration: 1500 });
      } else {
        toast(`Passed on ${profile.name}`, { duration: 1000 });
      }
      setCurrentIndex((prev) => prev + 1);
    },
    [currentIndex]
  );

  const remaining = profiles.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold font-display text-foreground">
          Spark<span className="text-primary">.</span>
        </h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 rounded-full gradient-love px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-card"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Boost
        </motion.button>
      </div>

      {/* Cards stack */}
      <div className="relative mx-4 flex-1 mb-4">
        <AnimatePresence>
          {remaining.length > 0 ? (
            remaining
              .map((profile, i) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isTop={i === 0}
                  onSwipeLeft={() => handleSwipe("left")}
                  onSwipeRight={() => handleSwipe("right")}
                />
              ))
              .reverse()
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex h-full flex-col items-center justify-center text-center"
            >
              <div className="rounded-full gradient-love p-6 mb-4">
                <Sparkles className="h-10 w-10 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-bold font-display text-foreground">
                No more profiles
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-[240px]">
                Check back later — new people join every day!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DiscoverView;
