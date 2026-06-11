import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Flame, Coins, Zap, Heart, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface DailyRewardsProps {
  open: boolean;
  onClose: () => void;
}

const DAY_REWARDS = [
  { day: 1, reward: "10 Coins", icon: Coins, emoji: "💰" },
  { day: 2, reward: "1 Boost", icon: Zap, emoji: "⚡" },
  { day: 3, reward: "20 Coins", icon: Coins, emoji: "💰" },
  { day: 4, reward: "2 Super Likes", icon: Heart, emoji: "❤️" },
  { day: 5, reward: "30 Coins", icon: Coins, emoji: "💰" },
  { day: 6, reward: "1 Spotlight", icon: Star, emoji: "🌟" },
  { day: 7, reward: "100 Coins + Boost", icon: Gift, emoji: "🎁" },
];

const DailyRewards = ({ open, onClose }: DailyRewardsProps) => {
  const { user } = useAuth();
  const [streakCount, setStreakCount] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    const check = async () => {
      const { data } = await supabase
        .from("daily_rewards")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!data) {
        setCanClaim(true);
        setStreakCount(0);
        return;
      }

      const lastClaim = new Date(data.last_claim_date);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 1) {
        setCanClaim(true);
        setStreakCount(diffDays === 1 ? data.streak_count : 0);
      } else {
        setCanClaim(false);
        setStreakCount(data.streak_count);
      }
    };
    check();
  }, [user, open]);

  const claimReward = async () => {
    if (!user || claiming) return;
    setClaiming(true);

    const { data, error } = await supabase.rpc("claim_daily_reward" as any);
    if (error) {
      toast.error(error.message || "Could not claim reward");
      setClaiming(false);
      return;
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    const newStreak = row?.streak_count ?? streakCount + 1;
    const dayIdx = row?.day_index ?? ((newStreak - 1) % 7);
    const reward = DAY_REWARDS[dayIdx];

    setStreakCount(newStreak);
    setCanClaim(false);
    setClaiming(false);
    toast.success(`${reward.emoji} Day ${dayIdx + 1}: ${reward.reward} claimed!`);
  };


  if (!open) return null;

  const currentDay = (streakCount % 7);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Daily Rewards</h2>
            </div>
            <button onClick={onClose} className="rounded-full bg-muted p-1.5">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4 bg-primary/10 rounded-xl p-3">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-sm font-bold text-foreground">{streakCount} Day Streak</span>
            <span className="text-xs text-muted-foreground ml-auto">Keep it going!</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {DAY_REWARDS.map((day, i) => {
              const claimed = i < currentDay;
              const isToday = i === currentDay && canClaim;
              const Icon = day.icon;
              return (
                <div
                  key={day.day}
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center ${
                    claimed
                      ? "bg-primary/20 border border-primary/30"
                      : isToday
                      ? "bg-accent/20 border-2 border-accent animate-pulse"
                      : "bg-muted"
                  }`}
                >
                  <span className="text-[9px] font-bold text-muted-foreground">D{day.day}</span>
                  <span className="text-sm">{day.emoji}</span>
                  {claimed && <span className="text-[8px] text-primary font-bold">✓</span>}
                </div>
              );
            })}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={canClaim ? claimReward : onClose}
            disabled={claiming}
            className={`w-full rounded-xl py-3 text-sm font-semibold shadow-sm ${
              canClaim
                ? "gradient-love text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {claiming ? "Claiming..." : canClaim ? "Claim Today's Reward! 🎁" : "Come Back Tomorrow!"}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DailyRewards;
