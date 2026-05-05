import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Lock, Eye, Crown, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface LikeEntry {
  id: string;
  liker_id: string;
  created_at: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    age: number | null;
  };
}

interface LikesViewProps {
  onShowVisitors?: () => void;
  onShowVIP?: () => void;
}

const LikesView = ({ onShowVisitors, onShowVIP }: LikesViewProps) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isPremium = false;

  const enrichLikes = async (rawLikes: any[]): Promise<LikeEntry[]> => {
    if (rawLikes.length === 0) return [];
    const likerIds = rawLikes.map((l) => l.liker_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, age")
      .in("user_id", likerIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    return rawLikes.map((l) => ({
      ...l,
      profile: profileMap.get(l.liker_id) as LikeEntry["profile"],
    }));
  };

  useEffect(() => {
    if (!user) return;

    const fetchLikes = async () => {
      const { data } = await supabase
        .from("likes")
        .select("*")
        .eq("liked_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (data) {
        const enriched = await enrichLikes(data);
        setLikes(enriched);
      }
      setLoading(false);
    };

    fetchLikes();

    // Realtime subscription
    const channel = supabase
      .channel("likes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes", filter: `liked_id=eq.${user.id}` },
        async (payload) => {
          const newLike = payload.new as any;
          const enriched = await enrichLikes([newLike]);
          setLikes((prev) => [enriched[0], ...prev.filter((l) => l.liker_id !== newLike.liker_id)]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Likes</h1>
          <p className="text-sm text-muted-foreground">
            {likes.length} {likes.length === 1 ? "person" : "people"} liked your profile
          </p>
        </div>
        {onShowVisitors && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onShowVisitors}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <Eye className="h-3.5 w-3.5" />
            Visitors
          </motion.button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading likes...</p>
        </div>
      ) : likes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          <div className="rounded-full gradient-love p-6 mb-4">
            <Heart className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-foreground font-semibold">No likes yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
            Keep swiping — your first like is on the way!
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1 pb-24">
          {likes.map((like, i) => (
            <motion.div
              key={like.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => !isPremium && setShowUpgrade(true)}
              className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-card bg-card border border-border cursor-pointer"
            >
              {like.profile?.avatar_url ? (
                <img
                  src={like.profile.avatar_url}
                  alt={isPremium ? like.profile.display_name : "Liked you"}
                  className={`h-full w-full object-cover transition-all ${!isPremium ? "blur-xl scale-110" : ""}`}
                />
              ) : (
                <div className={`h-full w-full flex items-center justify-center bg-muted ${!isPremium ? "blur-md" : ""}`}>
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {isPremium ? (like.profile?.display_name?.[0] || "?") : "?"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/70 to-transparent p-3">
                <p className="text-xs font-semibold text-primary-foreground truncate">
                  {isPremium ? (like.profile?.display_name || "Someone") : "Someone"}
                  {isPremium && like.profile?.age ? `, ${like.profile.age}` : ""}
                </p>
                <p className="text-[10px] text-primary-foreground/70">{timeAgo(like.created_at)}</p>
              </div>

              <div className="absolute top-2 right-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="rounded-full gradient-love p-1.5 shadow-card"
                >
                  <Heart className="h-3 w-3 text-primary-foreground fill-primary-foreground" />
                </motion.div>
              </div>

              {!isPremium && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground/10">
                  <div className="rounded-full bg-background/80 backdrop-blur-md p-2.5 mb-2">
                    <Lock className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[10px] font-semibold text-primary-foreground">Tap to unlock</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {!isPremium && likes.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowUpgrade(true)}
          className="sticky bottom-24 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card flex items-center justify-center gap-2"
        >
          <Crown className="h-4 w-4" />
          Unlock all {likes.length} likes
        </motion.button>
      )}

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgrade && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-foreground/60 backdrop-blur-sm"
              onClick={() => setShowUpgrade(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-1/2 z-[90] mx-auto max-w-sm -translate-y-1/2 rounded-3xl bg-card p-6 shadow-2xl border border-border"
            >
              <button
                onClick={() => setShowUpgrade(false)}
                className="absolute right-4 top-4 rounded-full bg-muted p-1.5"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full gradient-love">
                  <Crown className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold font-display text-foreground">Upgrade to PRO</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  See exactly who liked you 💖 and match instantly
                </p>
                <ul className="mt-4 space-y-2 text-left">
                  {[
                    "See everyone who liked you",
                    "Unlimited likes & super likes",
                    "Message before matching",
                    "Boost your profile weekly",
                  ].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> {b}
                    </li>
                  ))}
                </ul>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setShowUpgrade(false);
                    onShowVIP?.();
                  }}
                  className="mt-5 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground"
                >
                  Upgrade to PRO
                </motion.button>
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="mt-2 w-full py-2 text-xs text-muted-foreground"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LikesView;
