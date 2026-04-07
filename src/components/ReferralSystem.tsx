import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Share2, Copy, Users, Trophy, Gift, ArrowLeft, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ReferralSystemProps {
  onBack: () => void;
}

const ReferralSystem = ({ onBack }: ReferralSystemProps) => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ referrer_id: string; count: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      // Check for existing referral code
      const { data: existing } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .limit(1);

      if (existing && existing.length > 0) {
        setReferralCode(existing[0].referral_code);
      } else {
        const code = `SPARK-${user.id.slice(0, 6).toUpperCase()}`;
        setReferralCode(code);
      }

      // Get user's referrals
      const { data: refs } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id);
      setReferrals(refs || []);

      // Simple leaderboard from referrals count
      const { data: allRefs } = await supabase
        .from("referrals")
        .select("referrer_id")
        .eq("status", "completed");

      const counts: Record<string, number> = {};
      (allRefs || []).forEach((r) => {
        counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .map(([id, count]) => ({ referrer_id: id, count, name: `User ${id.slice(0, 4)}` }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setLeaderboard(sorted);
      setLoading(false);
    };
    init();
  }, [user]);

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success("Referral code copied! 📋");
  };

  const shareLink = () => {
    const url = `${window.location.origin}?ref=${referralCode}`;
    if (navigator.share) {
      navigator.share({ title: "Join me on Spark! 💕", text: `Use my code ${referralCode} to get free coins!`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Invite link copied!");
    }
  };

  const completedCount = referrals.filter((r) => r.status === "completed").length;
  const pendingCount = referrals.filter((r) => r.status === "pending").length;

  const rewards = [
    { invites: 1, reward: "50 Coins 💰", unlocked: completedCount >= 1 },
    { invites: 3, reward: "Free Boost ⚡", unlocked: completedCount >= 3 },
    { invites: 5, reward: "3 Super Likes ❤️", unlocked: completedCount >= 5 },
    { invites: 10, reward: "VIP Badge 👑", unlocked: completedCount >= 10 },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={onBack} className="rounded-full bg-muted p-2">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="text-xl font-bold font-display text-foreground">Invite Friends</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Referral Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 p-5"
        >
          <div className="text-center mb-3">
            <Share2 className="h-8 w-8 text-primary mx-auto mb-2" />
            <h2 className="text-lg font-bold text-foreground">Share & Earn</h2>
            <p className="text-xs text-muted-foreground mt-1">Invite friends and both of you get rewards!</p>
          </div>

          <div className="flex items-center gap-2 bg-card rounded-xl p-3">
            <span className="flex-1 text-center font-mono font-bold text-foreground tracking-wider">{referralCode}</span>
            <button onClick={copyCode} className="rounded-lg bg-muted p-2">
              <Copy className="h-4 w-4 text-foreground" />
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={shareLink}
            className="mt-3 w-full rounded-xl gradient-love py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share Invite Link
          </motion.button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-card p-4 text-center shadow-sm">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{completedCount}</p>
            <p className="text-[10px] text-muted-foreground">Joined</p>
          </div>
          <div className="rounded-xl bg-card p-4 text-center shadow-sm">
            <Gift className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
        </div>

        {/* Rewards */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Referral Rewards</h3>
          <div className="space-y-2">
            {rewards.map((r) => (
              <div
                key={r.invites}
                className={`flex items-center justify-between rounded-xl p-3 ${
                  r.unlocked ? "bg-primary/10 border border-primary/20" : "bg-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${r.unlocked ? "text-primary" : "text-muted-foreground"}`}>
                    {r.invites} invite{r.invites > 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-foreground">{r.reward}</span>
                </div>
                {r.unlocked && <span className="text-xs text-primary font-bold">✓ Unlocked</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
            <Trophy className="h-4 w-4 text-yellow-500" /> Invite Leaderboard
          </h3>
          {leaderboard.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Be the first to invite friends!</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.referrer_id} className="flex items-center gap-3 rounded-xl bg-card p-3">
                  <span className={`text-sm font-bold ${i < 3 ? "text-yellow-500" : "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">{entry.name}</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{entry.count} invites</span>
                  {i === 0 && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralSystem;
