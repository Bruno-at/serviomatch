import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Eye, SlidersHorizontal, X, Lock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MatchPopup from "@/components/MatchPopup";
import { toast } from "sonner";
import { likeUser } from "@/lib/likes";


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
}

type Filter = "all" | "new" | "online" | "near";

const TABS: { id: Filter; label: string; locked?: boolean }[] = [
  { id: "all", label: "All likes" },
  { id: "new", label: "New likes", locked: true },
  { id: "online", label: "Online", locked: true },
  { id: "near", label: "Near you", locked: true },
];

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

const LikesView = ({ onShowVisitors }: LikesViewProps) => {
  const { user } = useAuth();
  const [likes, setLikes] = useState<LikeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
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
    if (filter === "near") return likes.filter((l) => (l.profile?.distance_km ?? 99) <= 25);
    return likes;
  }, [likes, filter]);


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
      // Reciprocal like + match creation via secure RPC (direct match inserts are blocked)
      const res = await likeUser(user.id, like.liker_id);
      if (!res.ok || !res.matchId) {
        toast.error(res.error || "Could not create match");
        return;
      }
      const matchId = res.matchId;


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

  const boostCard = (
    <div
      key="boost-card"
      className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-md"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(265_85%_60%)] to-[hsl(285_80%_55%)] shadow-[0_8px_28px_-8px_hsl(270_85%_60%/0.8)]">
        <Zap className="h-6 w-6 fill-white text-white" />
      </div>
      <p className="text-[13px] font-semibold leading-snug text-white/90">
        Get shown to more people to get 4x more likes.
      </p>
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[hsl(260_40%_6%)] via-[hsl(260_30%_5%)] to-[hsl(260_30%_4%)] text-white overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(330_90%_55%/0.18),transparent_60%)]" />

      <div className="relative mx-auto w-full max-w-5xl px-5 pt-6 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] sm:text-[38px] font-bold font-display leading-tight tracking-tight">
              Your likes list
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
              The faster you like them back, the higher your chance of chatting and dating!
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
                <span className="hidden sm:inline">Visitors</span>
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

        <div className="mt-5 -mx-5 flex items-center gap-2 overflow-x-auto scrollbar-hide px-5 sm:mx-0 sm:px-0">
          {TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.96 }}
                onClick={() => setFilter(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                  active
                    ? "gradient-love text-white shadow-[0_6px_20px_-6px_hsl(350_80%_60%/0.6)]"
                    : "border border-white/10 bg-white/5 text-white/70"
                }`}
              >
                {tab.label}
                {tab.locked && <Lock className="h-3 w-3 opacity-80" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-5xl flex-1 px-5 pt-5 pb-32 sm:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {boostCard}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex aspect-[3/4] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center"
            >
              <div className="rounded-full gradient-love p-4 mb-3 shadow-[0_10px_40px_-8px_hsl(350_80%_60%/0.5)]">
                <Heart className="h-6 w-6 text-white" />
              </div>
              <p className="font-semibold text-white">No likes yet</p>
              <p className="text-xs text-white/50 mt-1">Keep swiping — your first like is on the way!</p>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                    alt={like.profile.display_name}
                    className="h-full w-full scale-110 object-cover blur-xl transition-all duration-500"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-purple-900/40 via-pink-900/30 to-orange-900/30 blur-xl" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25 pointer-events-none" />

                <div className="absolute top-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-md">
                  {timeAgo(like.created_at)}
                </div>

                <div className="absolute inset-x-0 bottom-0 p-2.5">
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={(e) => { e.stopPropagation(); handleDislike(like); }}
                      className="flex h-10 flex-1 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-md transition hover:bg-black/70"
                      aria-label="Dismiss"
                    >
                      <X className="h-4 w-4 text-white/90" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      disabled={pending === like.id}
                      onClick={(e) => { e.stopPropagation(); handleLikeBack(like); }}
                      className="flex h-10 flex-1 items-center justify-center rounded-full gradient-love shadow-[0_6px_20px_-6px_hsl(350_80%_60%/0.7)] disabled:opacity-60"
                      aria-label="Like back"
                    >
                      <Heart className="h-4 w-4 fill-white text-white" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
            {boostCard}
          </div>
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

    </div>
  );
};

export default LikesView;
