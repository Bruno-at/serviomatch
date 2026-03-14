import { Flame } from "lucide-react";
import { motion } from "framer-motion";

interface MatchStreakProps {
  count: number;
  compact?: boolean;
}

const MatchStreak = ({ count, compact = false }: MatchStreakProps) => {
  if (count <= 0) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-500">
        <Flame className="h-3 w-3" />
        {count}
      </span>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5"
    >
      <Flame className="h-3 w-3 text-orange-500" />
      <span className="text-[10px] font-bold text-orange-500">{count} Day Streak</span>
    </motion.div>
  );
};

export default MatchStreak;
