import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Lock, Eye, Crown, Sparkles, X, MapPin, BadgeCheck, SlidersHorizontal, Gem, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/hooks/usePremium";

interface LikeEntry {
  id: string;
  liker_id: string;
  created_at: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    age: number | null;
    city?: string | null;
    location?: string | null;
    distance_km?: number | null;
  };
}

interface LikesViewProps {
  onShowVisitors?: () => void;
  onShowVIP?: () => void;
}

type Filter = "all" | "new" | "recent";

const LikesView = ({ onShowVisitors, onShowVIP }: LikesViewProps) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const { isPremium, isDeveloper } = usePremium();

  const enrichLikes = async (rawLikes: any[]): Promise<LikeEntry[]> => {
    if (rawLikes.length === 0) return [];
    const likerIds = rawLikes.map((l) => l.liker_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, age, location")
      .in("user_id", likerIds);
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    return rawLikes.map((l, i) => {
      const p = profileMap.get(l.liker_id) as any;
      return {
        ...l,
        profile: {
          ...(p || {}),
          distance_km: ((i + 1) * 1), // pseudo distance for display
        },
      };
    });
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

  const filtered = useMemo(() => {
    const now = Date.now();
    if (filter === "new") return likes.filter((l) => now - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000);
    if (filter === "recent") return likes.filter((l) => now - new Date(l.created_at).getTime() < 3 * 24 * 60 * 60 * 1000);
    return likes;
  }, [likes, filter]);

  const newCount = useMemo(
    () => likes.filter((l) => Date.now() - new Date(l.created_at).getTime() < 24 * 60 * 60 * 1000).length,
    [likes]
  );

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[hsl(260_40%_6%)] via-[hsl(260_30%_5%)] to-[hsl(260_30%_4%)] text-white overflow-y-auto">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(330_90%_55%/0.18),transparent_60%)]" />

      <div className="relative px-5 pt-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[34px] font-bold font-display leading-none tracking-tight">Likes You</h1>
              <span className="flex items-center gap-1 rounded-full gradient-love px-2.5 py-1 text-xs font-bold shadow-[0_4px_20px_-4px_hsl(350_80%_60%/0.6)]">
                <Heart className="h-3 w-3 fill-white" /> {likes.length}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-white/60">
              <span className="text-primary font-semibold">{likes.length}</span> people liked your profile
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onShowVisitors && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onShowVisitors}
                className="relative flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-white/80 backdrop-blur-md"
              >
                <Eye className="h-3.5 w-3.5" />
                Visitors
                <span className="absolute -top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/80 backdrop-blur-md"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        {/* Premium upgrade banner */}
        {!isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mt-5 overflow-hidden rounded-3xl border border-white/10 p-4"
            style={{
              background:
                "linear-gradient(135deg, hsl(280 60% 22% / 0.9), hsl(260 50% 14% / 0.95))",
            }}
          >
            <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
            <div className="absolute right-6 top-3 text-primary/60">
              <Heart className="h-5 w-5 fill-primary/40" />
            </div>
            <div className="absolute right-12 top-10 text-primary/80">
              <Heart className="h-7 w-7 fill-primary/60" />
            </div>
            <div className="absolute right-3 top-12 text-primary/50">
              <Heart className="h-4 w-4 fill-primary/30" />
            </div>
            <div className="relative flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 shadow-[0_8px_30px_-4px_hsl(25_90%_60%/0.5)]">
                <Crown className="h-8 w-8 text-white drop-shadow" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-tight">Unlock all your likes</h3>
                <p className="mt-0.5 text-xs text-white/60">Upgrade to Pro and see who likes you</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowUpgrade(true)}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full gradient-love px-4 py-2 text-xs font-semibold shadow-[0_6px_20px_-4px_hsl(350_80%_60%/0.6)]"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Upgrade to Pro
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filter tabs */}
        <div className="mt-5 flex items-center gap-2">
          {([
            { id: "all", label: `All ${likes.length}` },
            { id: "new", label: "New", badge: newCount },
            { id: "recent", label: "Recent" },
          ] as { id: Filter; label: string; badge?: number }[]).map((tab) => {
            const active = filter === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  active
                    ? "gradient-love text-white shadow-[0_6px_20px_-6px_hsl(350_80%_60%/0.6)]"
                    : "border border-white/10 bg-white/5 text-white/70"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? "bg-white/20" : "gradient-love text-white"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="relative px-5 pt-5 pb-32 flex-1">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center text-center py-20"
          >
            <div className="rounded-full gradient-love p-6 mb-4 shadow-[0_10px_40px_-8px_hsl(350_80%_60%/0.5)]">
              <Heart className="h-8 w-8 text-white" />
            </div>
            <p className="font-semibold text-white">No likes yet</p>
            <p className="text-sm text-white/50 mt-1 max-w-[220px]">
              Keep swiping — your first like is on the way!
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((like, i) => (
              <motion.div
                key={like.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => !isPremium && setShowUpgrade(true)}
                className="group relative aspect-[3/4] cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
              >
                {/* Photo */}
                {like.profile?.avatar_url ? (
                  <img
                    src={like.profile.avatar_url}
                    alt={isPremium ? like.profile.display_name : "Liked you"}
                    className={`h-full w-full object-cover transition-all duration-500 ${
                      !isPremium ? "scale-110 blur-2xl" : "group-hover:scale-105"
                    }`}
                  />
                ) : (
                  <div className={`h-full w-full bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-orange-900/30 ${!isPremium ? "blur-xl" : ""}`} />
                )}

                {/* Dim overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

                {/* Time badge */}
                <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
                  {timeAgo(like.created_at)}
                </div>

                {/* Lock icon center (free) */}
                {!isPremium && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md shadow-lg">
                      <Lock className="h-5 w-5 text-white/90" />
                    </div>
                  </div>
                )}

                {/* Bottom info */}
                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-bold text-white">
                      {isPremium ? (like.profile?.display_name || "Someone") : "Someone"}
                    </p>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-white" />
                  </div>
                  <p className="text-[11px] text-white/80">
                    {isPremium && like.profile?.age ? `${like.profile.age}` : (like.profile?.age ?? 24)}
                    {like.profile?.location ? `, ${like.profile.location}` : ", Kampala"}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] text-white/70">
                      <MapPin className="h-3 w-3" />
                      {like.profile?.distance_km ?? 1} km away
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); !isPremium && setShowUpgrade(true); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/60 bg-primary/15 backdrop-blur-md"
                    >
                      <Heart className="h-3.5 w-3.5 fill-primary text-primary" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {!isPremium && filtered.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowUpgrade(true)}
            className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-md"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-[0_6px_20px_-4px_hsl(320_80%_60%/0.6)]">
              <Gem className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-white">See everyone who likes you</p>
              <p className="text-[11px] text-white/60">Upgrade to Pro and match instantly</p>
            </div>
            <span className="flex items-center gap-1 rounded-full gradient-love px-3.5 py-2 text-xs font-semibold text-white shadow-[0_6px_20px_-4px_hsl(350_80%_60%/0.6)]">
              Upgrade Now <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </motion.button>
        )}
      </div>

      {/* Upgrade Modal */}
      <AnimatePresence>
        {showUpgrade && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
              onClick={() => setShowUpgrade(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="fixed inset-x-4 top-1/2 z-[90] mx-auto max-w-sm -translate-y-1/2 rounded-3xl border border-white/10 bg-gradient-to-b from-[hsl(260_40%_12%)] to-[hsl(260_40%_8%)] p-6 shadow-2xl text-white"
            >
              <button
                onClick={() => setShowUpgrade(false)}
                className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5"
              >
                <X className="h-4 w-4 text-white/80" />
              </button>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 shadow-[0_10px_30px_-6px_hsl(25_90%_60%/0.6)]">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold font-display">Upgrade to PRO</h3>
                <p className="mt-2 text-sm text-white/60">
                  See exactly who liked you 💖 and match instantly
                </p>
                <ul className="mt-4 space-y-2 text-left">
                  {[
                    "See everyone who liked you",
                    "Unlimited likes & super likes",
                    "Message before matching",
                    "Boost your profile weekly",
                  ].map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs text-white/85">
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
                  className="mt-5 w-full rounded-2xl gradient-love py-3.5 text-sm font-semibold shadow-[0_8px_30px_-6px_hsl(350_80%_60%/0.6)]"
                >
                  Upgrade to PRO
                </motion.button>
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="mt-2 w-full py-2 text-xs text-white/50"
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
