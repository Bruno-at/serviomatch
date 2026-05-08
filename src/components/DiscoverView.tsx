import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Undo2, SlidersHorizontal } from "lucide-react";
import ProfileCard from "./ProfileCard";
import ReportDialog from "./ReportDialog";
import CompatibilityDialog from "./CompatibilityDialog";
import MatchPopup from "./MatchPopup";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { computeCompatibility, type PersonalityAnswers } from "./PersonalityQuestions";

interface DiscoverViewProps {
  onShowFavorites?: () => void;
  onShowBookmarks?: () => void;
  onNavigateToChat?: (matchId: string, profile: Tables<"profiles">) => void;
}

type GenderPref = "all" | "male" | "female" | "other";

interface Filters {
  maxDistance: number; // km
  ageRange: [number, number];
  gender: GenderPref;
  onlineOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  maxDistance: 50,
  ageRange: [18, 45],
  gender: "all",
  onlineOnly: false,
};

const DiscoverView = ({ onShowFavorites, onShowBookmarks, onNavigateToChat }: DiscoverViewProps) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<Tables<"profiles"> | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [matchPopup, setMatchPopup] = useState<{ matchId: string; matchName: string; matchPhoto: string | null } | null>(null);
  const [compatTarget, setCompatTarget] = useState<{ name: string; score: number; shared: string[]; matchedQuestions: string[] } | null>(null);
  const [lastSwiped, setLastSwiped] = useState<{ profile: Tables<"profiles">; direction: string } | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const MAX_FREE_UNDOS = 3;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: myData } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setMyProfile(myData);

      const [{ data: blockedData }, { data: likedData }] = await Promise.all([
        supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
        supabase.from("likes").select("liked_id").eq("liker_id", user.id),
      ]);

      const excludeIds = [user.id, ...(likedData?.map((l) => l.liked_id) || []), ...(blockedData?.map((b: any) => b.blocked_id) || [])];

      let query = supabase.from("profiles").select("*").not("user_id", "in", `(${excludeIds.join(",")})`).limit(40);

      // Age range filter
      query = query.gte("age", filters.ageRange[0]).lte("age", filters.ageRange[1]);

      // Online only
      if (filters.onlineOnly) {
        query = query.eq("is_online", true);
      }

      const { data } = await query;

      const sorted = (data || []).sort((a, b) => {
        const aBoosted = a.is_boosted && a.boost_expires_at && new Date(a.boost_expires_at) > new Date() ? 1 : 0;
        const bBoosted = b.is_boosted && b.boost_expires_at && new Date(b.boost_expires_at) > new Date() ? 1 : 0;
        if (bBoosted !== aBoosted) return bBoosted - aBoosted;
        if (myData) {
          const aCompat = computeCompatibility(
            { interests: myData.interests, personality_answers: (myData.personality_answers || {}) as PersonalityAnswers },
            { interests: a.interests, personality_answers: (a.personality_answers || {}) as PersonalityAnswers }
          ).score;
          const bCompat = computeCompatibility(
            { interests: myData.interests, personality_answers: (myData.personality_answers || {}) as PersonalityAnswers },
            { interests: b.interests, personality_answers: (b.personality_answers || {}) as PersonalityAnswers }
          ).score;
          return bCompat - aCompat;
        }
        return 0;
      });

      setProfiles(sorted);
      setCurrentIndex(0);
      setLoading(false);
    };
    fetchData();
  }, [user, activeFilter]);

  const currentProfile = profiles[currentIndex];

  useEffect(() => {
    if (!user || !currentProfile) return;
    supabase.from("profile_visitors").upsert(
      { visitor_id: user.id, visited_id: currentProfile.user_id },
      { onConflict: "visitor_id,visited_id" }
    );
  }, [currentProfile?.user_id, user]);

  const handleSwipe = useCallback(async (direction: "left" | "right") => {
    if (!user || !currentProfile) return;
    await supabase.from("swipe_history").insert({ user_id: user.id, swiped_id: currentProfile.user_id, direction });
    setLastSwiped({ profile: currentProfile, direction });

    if (direction === "right") {
      await supabase.from("likes").insert({ liker_id: user.id, liked_id: currentProfile.user_id });
      const { data: mutual } = await supabase.from("likes").select("id")
        .eq("liker_id", currentProfile.user_id).eq("liked_id", user.id).maybeSingle();
      if (mutual) {
        const [u1, u2] = [user.id, currentProfile.user_id].sort();
        const { data: matchData } = await supabase.from("matches").insert({ user1_id: u1, user2_id: u2 }).select().single();
        setMatchPopup({ matchId: matchData?.id || "", matchName: currentProfile.display_name, matchPhoto: currentProfile.avatar_url });
      } else {
        toast.success(`You liked ${currentProfile.display_name}! 💕`, { duration: 1500 });
      }
    } else {
      toast(`Passed on ${currentProfile.display_name}`, { duration: 1000 });
    }
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex, profiles, user, currentProfile]);

  const handleSuperLike = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("swipe_history").insert({ user_id: user.id, swiped_id: currentProfile.user_id, direction: "up" });
    await supabase.from("super_likes").insert({ liker_id: user.id, liked_id: currentProfile.user_id });
    await supabase.from("likes").insert({ liker_id: user.id, liked_id: currentProfile.user_id });
    setLastSwiped({ profile: currentProfile, direction: "up" });
    toast.success(`🔥 Super Liked ${currentProfile.display_name}!`, { duration: 2000 });
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfile, user]);

  const handleUndo = useCallback(async () => {
    if (!lastSwiped || !user) return;
    if (undoCount >= MAX_FREE_UNDOS) {
      toast.error("Free undos used up! Upgrade to Premium for unlimited undos ✨");
      return;
    }
    await supabase.from("likes").delete().eq("liker_id", user.id).eq("liked_id", lastSwiped.profile.user_id);
    await supabase.from("super_likes").delete().eq("liker_id", user.id).eq("liked_id", lastSwiped.profile.user_id);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setUndoCount((prev) => prev + 1);
    setLastSwiped(null);
    toast.success(`↩️ Undo! (${MAX_FREE_UNDOS - undoCount - 1} left)`);
  }, [lastSwiped, user, undoCount]);

  const handleFavorite = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("favorites").insert({ user_id: user.id, favorited_id: currentProfile.user_id });
    toast.success(`⭐ Added ${currentProfile.display_name} to favorites`);
  }, [currentProfile, user]);

  const handleBookmark = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("swipe_history").insert({ user_id: user.id, swiped_id: currentProfile.user_id, direction: "down" });
    await supabase.from("bookmarks").insert({ user_id: user.id, bookmarked_id: currentProfile.user_id });
    toast.success(`🔖 Bookmarked ${currentProfile.display_name}`);
    setLastSwiped({ profile: currentProfile, direction: "down" });
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfile, user]);

  const handleWave = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("waves").insert({ sender_id: user.id, receiver_id: currentProfile.user_id });
    toast.success(`👋 Waved at ${currentProfile.display_name}!`);
  }, [currentProfile, user]);

  const handleBoost = useCallback(() => {
    toast.success("⚡ Your profile is now boosted for 30 minutes!", { duration: 3000 });
  }, []);

  const handleCompliment = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("compliments").insert({ sender_id: user.id, receiver_id: currentProfile.user_id, message: "You have a great smile 😊" });
    toast.success(`💬 Compliment sent to ${currentProfile.display_name}!`);
  }, [currentProfile, user]);

  const handleCompatibility = useCallback(() => {
    if (!currentProfile || !myProfile) return;
    const result = computeCompatibility(
      { interests: myProfile.interests, personality_answers: (myProfile.personality_answers || {}) as PersonalityAnswers },
      { interests: currentProfile.interests, personality_answers: (currentProfile.personality_answers || {}) as PersonalityAnswers }
    );
    setCompatTarget({ name: currentProfile.display_name, score: result.score, shared: result.sharedInterests, matchedQuestions: result.matchedQuestions });
  }, [currentProfile, myProfile]);

  const handleShare = useCallback(async () => {
    if (!currentProfile) return;
    const data = { title: `Check out ${currentProfile.display_name} on Spark!`, url: window.location.href };
    try {
      if (navigator.share && navigator.canShare?.(data) !== false) {
        await navigator.share(data);
        return;
      }
      throw new Error("unsupported");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Profile link copied!");
      } catch {}
    }
  }, [currentProfile]);

  const handleReport = useCallback(() => {
    if (!currentProfile) return;
    setReportTarget({ id: currentProfile.user_id, name: currentProfile.display_name });
  }, [currentProfile]);

  const handleSecretCrush = useCallback(async () => {
    if (!user || !currentProfile) return;
    const { error } = await supabase.from("secret_crushes").insert({ crusher_id: user.id, crushed_id: currentProfile.user_id });
    if (error) {
      if (error.code === "23505") toast.info("Already in your crush list 💖");
      else toast.error("Failed to add secret crush");
      return;
    }
    const { data: reverse } = await supabase.from("secret_crushes").select("id")
      .eq("crusher_id", currentProfile.user_id).eq("crushed_id", user.id).maybeSingle();
    if (reverse) {
      await supabase.from("secret_crushes").update({ is_mutual: true }).eq("crusher_id", user.id).eq("crushed_id", currentProfile.user_id);
      await supabase.from("secret_crushes").update({ is_mutual: true }).eq("crusher_id", currentProfile.user_id).eq("crushed_id", user.id);
      const [u1, u2] = [user.id, currentProfile.user_id].sort();
      await supabase.from("matches").insert({ user1_id: u1, user2_id: u2 });
      toast.success("💖 It's a Secret Match!");
    } else {
      toast.success(`💖🔒 Added ${currentProfile.display_name} as a secret crush`);
    }
  }, [currentProfile, user]);

  const remaining = profiles.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 border-b border-border/40">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold font-display tracking-tight text-foreground leading-none">
            Spark<span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {activeFilter === "all"
              ? "Curated for you"
              : filterOptions.find((f) => f.key === activeFilter)?.label}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {lastSwiped && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleUndo}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9 hover:bg-muted/70 transition-colors">
              <Undo2 className="h-4 w-4 text-primary" />
            </motion.button>
          )}
          {onShowFavorites && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onShowFavorites}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9 hover:bg-muted/70 transition-colors">
              <Star className="h-4 w-4 text-yellow-500" />
            </motion.button>
          )}
          {onShowBookmarks && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onShowBookmarks}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9 hover:bg-muted/70 transition-colors">
              <Bookmark className="h-4 w-4 text-accent" />
            </motion.button>
          )}
          <BoostSpotlight compact />
        </div>
      </div>

      {/* Filter chips - horizontal scroll */}
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {filterOptions.map((f) => {
            const Icon = f.icon;
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all border ${
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Card stack area */}
      <div className="relative mx-4 flex-1 mb-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-xs text-muted-foreground">Finding people near you...</p>
            </div>
          </div>
        ) : (
          <AnimatePresence>
            {remaining.length > 0 ? (
              remaining.map((profile, i) => (
                <ProfileCard
                  key={profile.id}
                  profile={{
                    id: profile.id,
                    name: profile.display_name,
                    age: profile.age || 0,
                    distance: profile.location || "Nearby",
                    bio: profile.bio || "",
                    image: profile.avatar_url || "",
                    interests: profile.interests || [],
                    prompts: [],
                    verified: !!profile.is_verified,
                  }}
                  isTop={i === 0}
                  onSwipeLeft={() => handleSwipe("left")}
                  onSwipeRight={() => handleSwipe("right")}
                  onSuperLike={handleSuperLike}
                  onFavorite={handleFavorite}
                  onBookmark={handleBookmark}
                  onWave={handleWave}
                  onBoost={handleBoost}
                  onCompliment={handleCompliment}
                  onCompatibility={handleCompatibility}
                  onShare={handleShare}
                  onReport={handleReport}
                  onSecretCrush={handleSecretCrush}
                />
              )).reverse()
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full gradient-love p-6 mb-4">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold font-display text-foreground">No more profiles</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-[240px]">
                  Check back later — new people join every day!
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {reportTarget && <ReportDialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)} targetUserId={reportTarget.id} targetName={reportTarget.name} />}
      {compatTarget && <CompatibilityDialog open={!!compatTarget} onClose={() => setCompatTarget(null)} name={compatTarget.name} score={compatTarget.score} sharedInterests={compatTarget.shared} matchedQuestions={compatTarget.matchedQuestions} />}
      <MatchPopup open={!!matchPopup} myPhoto={myProfile?.avatar_url} myName={myProfile?.display_name || "You"} matchPhoto={matchPopup?.matchPhoto} matchName={matchPopup?.matchName || ""}
        onChat={() => {
          if (matchPopup && onNavigateToChat) {
            const matchedProfile = profiles.find((p) => p.display_name === matchPopup.matchName);
            if (matchedProfile) onNavigateToChat(matchPopup.matchId, matchedProfile);
          }
          setMatchPopup(null);
        }}
        onClose={() => setMatchPopup(null)}
      />
    </div>
  );
};

export default DiscoverView;
