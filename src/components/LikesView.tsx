import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Lock, Eye, Crown, Sparkles, X, MapPin, BadgeCheck, SlidersHorizontal, Gem, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/hooks/usePremium";
import MatchPopup from "@/components/MatchPopup";
import { toast } from "sonner";

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

const buildQuickMessage = (name: string) => {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const options = [
    `Hey ${name} 👋 you look amazing!`,
    `Hi ${name} 😊 I'd love to know you better.`,
    `${greet} ${name} 💖 your smile caught my attention.`,
    `Hey ${name}! ✨ So glad we matched.`,
  ];
  return options[Math.floor(Math.random() * options.length)];
};

const LikesView = ({ onShowVisitors, onShowVIP }: LikesViewProps) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const { isPremium, isDeveloper } = usePremium();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [match, setMatch] = useState<null | {
    matchId: string;
    name: string;
    photo: string | null;
    likerId: string;
  }>(null);
  const [myProfile, setMyProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

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
          distance_km: ((i + 1) * 1),
        },
      };
    });
  };

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      const [likesRes, meRes, dismissedRes] = await Promise.all([
        supabase.from("likes").select("*").eq("liked_id", user.id).order("created_at", { ascending: false }).limit(60),
        supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("swipe_history").select("swiped_id").eq("user_id", user.id).eq("direction", "left"),
      ]);

      const dismissedSet = new Set<string>((dismissedRes.data || []).map((d: any) => d.swiped_id));
      setDismissed(dismissedSet);
      setMyProfile(meRes.data || { display_name: "You", avatar_url: null });

      const filtered = (likesRes.data || []).filter((l: any) => !dismissedSet.has(l.liker_id));
      const enriched = await enrichLikes(filtered);
      setLikes(enriched);
      setLoading(false);
    };

    fetchAll();

    const channel = supabase
      .channel("likes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "likes", filter: `liked_id=eq.${user.id}` },
        async (payload) => {
          const newLike = payload.new as any;
          if (dismissed.has(newLike.liker_id)) return;
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

  const handleDislike = async (like: LikeEntry) => {
    if (!user) return;
    setLikes((prev) => prev.filter((l) => l.id !== like.id));
    setDismissed((prev) => new Set(prev).add(like.liker_id));
    await supabase.from("swipe_history").insert({
      user_id: user.id,
      swiped_id: like.liker_id,
      direction: "left",
    });
  };

  const handleLikeBack = async (like: LikeEntry) => {
    if (!user || pending) return;
    setPending(like.id);
    try {
      // Insert reciprocal like (idempotent-ish)
      await supabase.from("likes").insert({
        liker_id: user.id,
        liked_id: like.liker_id,
      });

      // Create match (user1 < user2 ordering for consistency)
      const [u1, u2] = [user.id, like.liker_id].sort();
      const { data: existing } = await supabase
        .from("matches")
        .select("id")
        .eq("user1_id", u1)
        .eq("user2_id", u2)
        .maybeSingle();

      let matchId = existing?.id;
      if (!matchId) {
        const { data: newMatch } = await supabase
          .from("matches")
          .insert({ user1_id: u1, user2_id: u2 })
          .select("id")
          .maybeSingle();
        matchId = newMatch?.id;
      }

      if (!matchId) {
        toast.error("Could not create match");
        return;
      }

      // Notify the other user
      try {
        await supabase.rpc("send_notification", {
          _target_user_id: like.liker_id,
          _type: "match",
          _title: "It's a match! 💖",
          _message: `You matched with ${myProfile?.display_name || "someone"}`,
        });
      } catch {}

      // Self notification
      try {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "match",
          title: "It's a match! 💖",
          message: `You matched with ${like.profile?.display_name || "someone"}`,
        });
      } catch {}

      setLikes((prev) => prev.filter((l) => l.id !== like.id));
      setMatch({
        matchId,
        name: like.profile?.display_name || "Match",
        photo: like.profile?.avatar_url || null,
        likerId: like.liker_id,
      });
    } finally {
      setPending(null);
    }
  };

  const handleQuickMessage = async () => {
    if (!match || !user) return;
    const msg = buildQuickMessage(match.name.split(" ")[0] || "");
    await supabase.from("messages").insert({
      match_id: match.matchId,
      sender_id: user.id,
      content: msg,
    });
    toast.success("Message sent ✨");
    setMatch(null);
  };

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[hsl(260_40%_6%)] via-[hsl(260_30%_5%)] to-[hsl(260_30%_4%)] text-white overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(330_90%_55%/0.18),transparent_60%)]" />

      <div className="relative px-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[34px] font-bold font-display leading-none tracking-tight">Likes You</h1>
              <span className="flex items-center gap-1 rounded-full gradient-love px-2.5 py-1 text-xs font-bold shadow-[0_4px_20px_-4px_hsl(350_80%_60%/0.6)]">
                <Heart className="h-3 w-3 fill-white" /> {likes.length}
              </span>
              {isDeveloper && (
                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-1 text-[10px] font-bold text-black shadow-[0_4px_20px_-4px_hsl(30_90%_55%/0.6)]">
                  <Crown className="h-3 w-3" /> Developer
                </span>
              )}
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
            <AnimatePresence>
            {filtered.map((like, i) => (
              <motion.div
                key={like.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ delay: i * 0.03 }}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
              >
                {like.profile?.avatar_url ? (
                  <img
                    src={like.profile.avatar_url}
                    alt={isPremium ? like.profile.display_name : "Liked you"}
                    onClick={() => !isPremium && setShowUpgrade(true)}
                    className={`h-full w-full object-cover transition-all duration-500 cursor-pointer ${
                      !isPremium ? "scale-110 blur-2xl" : "group-hover:scale-105"
                    }`}
                  />
                ) : (
                  <div className={`h-full w-full bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-orange-900/30 ${!isPremium ? "blur-xl" : ""}`} />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

                <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
                  {timeAgo(like.created_at)}
                </div>

                {!isPremium && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="rounded-full border border-white/20 bg-white/10 p-3 backdrop-blur-md shadow-lg">
                      <Lock className="h-5 w-5 text-white/90" />
                    </div>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-bold text-white">
                      {isPremium ? (like.profile?.display_name || "Someone") : "Someone"}
                    </p>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-white" />
                  </div>
                  <p className="text-[11px] text-white/80">
                    {like.profile?.age ?? 24}
                    {like.profile?.location ? `, ${like.profile.location}` : ", Kampala"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); handleDislike(like); }}
                      className="flex h-9 flex-1 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-md transition hover:bg-black/70"
                      aria-label="Dislike"
                    >
                      <X className="h-4 w-4 text-white/90" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      disabled={pending === like.id}
                      onClick={(e) => { e.stopPropagation(); handleLikeBack(like); }}
                      className="flex h-9 flex-[1.4] items-center justify-center gap-1 rounded-full gradient-love shadow-[0_6px_20px_-6px_hsl(350_80%_60%/0.7)] disabled:opacity-60"
                      aria-label="Like back"
                    >
                      <Heart className="h-4 w-4 fill-white text-white" />
                      <span className="text-[11px] font-bold text-white">Like</span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}

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

      {/* Match popup */}
      <MatchPopup
        open={!!match}
        myName={myProfile?.display_name || "You"}
        myPhoto={myProfile?.avatar_url || null}
        matchName={match?.name || ""}
        matchPhoto={match?.photo || null}
        onChat={handleQuickMessage}
        onClose={() => setMatch(null)}
      />

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
