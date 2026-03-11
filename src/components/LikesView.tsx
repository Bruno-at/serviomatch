import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Lock, Eye } from "lucide-react";
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
}

const LikesView = ({ onShowVisitors }: LikesViewProps) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [loading, setLoading] = useState(true);
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
              className="relative aspect-[3/4] overflow-hidden rounded-2xl shadow-card bg-card border border-border"
            >
              {isPremium && like.profile?.avatar_url ? (
                <img
                  src={like.profile.avatar_url}
                  alt={like.profile.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted">
                  <Avatar className="h-16 w-16">
                    {isPremium ? (
                      <>
                        <AvatarImage src={like.profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                          {like.profile?.display_name?.[0] || "?"}
                        </AvatarFallback>
                      </>
                    ) : (
                      <AvatarFallback className="bg-primary/10">
                        <Lock className="h-6 w-6 text-primary/50" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
              )}

              {/* Overlay info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/70 to-transparent p-3">
                <p className="text-xs font-semibold text-primary-foreground truncate">
                  {isPremium ? (like.profile?.display_name || "Someone") : "Someone"}
                  {isPremium && like.profile?.age ? `, ${like.profile.age}` : ""}
                </p>
                <p className="text-[10px] text-primary-foreground/70">{timeAgo(like.created_at)}</p>
              </div>

              {/* Heart badge */}
              <div className="absolute top-2 right-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="rounded-full gradient-love p-1.5 shadow-card"
                >
                  <Heart className="h-3 w-3 text-primary-foreground fill-primary-foreground" />
                </motion.div>
              </div>

              {/* Blurred lock overlay for free users */}
              {!isPremium && (
                <div className="absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm bg-foreground/5">
                  <Lock className="h-5 w-5 text-primary-foreground mb-1" />
                  <span className="text-[10px] font-semibold text-primary-foreground">Upgrade to see</span>
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
          className="sticky bottom-24 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold text-primary-foreground shadow-card"
        >
          Unlock all likes
        </motion.button>
      )}
    </div>
  );
};

export default LikesView;
