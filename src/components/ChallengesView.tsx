import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Flame, Crown, ChevronDown, Star, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export interface Challenge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  target_count: number;
  reward_coins: number;
  reward_badge: string | null;
}

export interface UserChallenge {
  challenge_id: string;
  progress: number;
  completed: boolean;
}

export interface IncrementChallengeResult {
  progress: number;
  completed: boolean;
  reward_coins: number;
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  badge_count: number;
  is_online: boolean;
}

type Tab = "challenges" | "leaderboard";

interface ChallengesViewProps {
  onBack: () => void;
}

const ChallengesView = ({ onBack }: ChallengesViewProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("challenges");
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCoins, setTotalCoins] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<string, { kind: "success" | "error"; message: string } | undefined>>({});

    const fetchData = async () => {
      const [{ data: cData }, { data: ucData }, { data: coinData }] = await Promise.all([
        supabase.from("challenges").select("*").eq("active", true),
        supabase.from("user_challenges").select("challenge_id, progress, completed").eq("user_id", user.id),
        supabase.from("user_coins").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);

      if (cData) setChallenges(cData as Challenge[]);
      if (ucData) setUserChallenges(ucData);
      setTotalCoins(coinData?.balance || 0);

      // Leaderboard: users with most badges
      const { data: badges } = await supabase.from("user_badges").select("user_id");
      if (badges) {
        const counts: Record<string, number> = {};
        badges.forEach((b) => { counts[b.user_id] = (counts[b.user_id] || 0) + 1; });

        const topIds = Object.entries(counts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([id]) => id);

        if (topIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url, is_online")
            .in("user_id", topIds);

          if (profiles) {
            const lb = profiles
              .map((p) => ({
                ...p,
                is_online: p.is_online ?? false,
                badge_count: counts[p.user_id] || 0,
              }))
              .sort((a, b) => b.badge_count - a.badge_count);
            setLeaderboard(lb);
          }
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;
    const existing = userChallenges.find((uc) => uc.challenge_id === challengeId);
    if (existing) return;

    await supabase.from("user_challenges").insert({
      user_id: user.id,
      challenge_id: challengeId,
      progress: 0,
    });
    setUserChallenges((prev) => [...prev, { challenge_id: challengeId, progress: 0, completed: false }]);
    toast.success("🏆 Challenge accepted!");
  };

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (i === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (i === 2) return <Medal className="h-5 w-5 text-accent" />;
    return <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold font-display text-foreground">Challenges</h1>
          <p className="text-xs text-muted-foreground">Earn coins & badges</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1">
          <span className="text-xs">🪙</span>
          <span className="text-xs font-bold text-accent">{totalCoins}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mx-4 mb-3 bg-muted rounded-xl p-1">
        {(["challenges", "leaderboard"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t === "challenges" ? "🎯 Challenges" : "🏆 Leaderboard"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : tab === "challenges" ? (
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
          {challenges.map((c, i) => {
            const uc = userChallenges.find((u) => u.challenge_id === c.id);
            const progress = uc ? Math.min((uc.progress / c.target_count) * 100, 100) : 0;
            const joined = !!uc;
            const completed = uc?.completed;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border p-4 ${
                  completed
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-card border-border"
                } shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-foreground">{c.title}</h3>
                      {completed && <span className="text-xs text-green-600 font-semibold">✅ Done</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>

                    {joined && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">
                            {uc!.progress}/{c.target_count}
                          </span>
                          <span className="text-[10px] text-accent font-medium">
                            🪙 {c.reward_coins} coins
                          </span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}

                    {!joined && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => joinChallenge(c.id)}
                        className="mt-2 rounded-xl bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary"
                      >
                        Accept Challenge
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2">
          {leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
              <p className="text-xs text-muted-foreground mt-1">Complete challenges to appear here!</p>
            </div>
          ) : (
            leaderboard.map((entry, i) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-3 rounded-2xl p-3 ${
                  i < 3 ? "bg-accent/5 border border-accent/15" : "bg-card border border-border"
                }`}
              >
                {getRankIcon(i)}
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={entry.avatar_url || ""} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                      {entry.display_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  {entry.is_online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{entry.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">{entry.badge_count} badges earned</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-foreground">{entry.badge_count}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ChallengesView;
