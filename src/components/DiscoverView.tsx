import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Star, Bookmark, Zap, Undo2 } from "lucide-react";
import ProfileCard from "./ProfileCard";
import ReportDialog from "./ReportDialog";
import CompatibilityDialog from "./CompatibilityDialog";
import MatchPopup from "./MatchPopup";
import AIRecommendations from "./AIRecommendations";
import BoostSpotlight from "./BoostSpotlight";
import NearbyTonight from "./NearbyTonight";
import SpotlightProfiles from "./SpotlightProfiles";
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
  const MAX_FREE_UNDOS = 3;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: myData } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      setMyProfile(myData);

      const [{ data: blockedData }, { data: likedData }] = await Promise.all([
        supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
        supabase.from("likes").select("liked_id").eq("liker_id", user.id),
      ]);

      const excludeIds = [user.id, ...(likedData?.map((l) => l.liked_id) || []), ...(blockedData?.map((b: any) => b.blocked_id) || [])];

      const { data } = await supabase.from("profiles").select("*").not("user_id", "in", `(${excludeIds.join(",")})`).limit(20);

      // Sort: boosted first, then by shared interests
      const sorted = (data || []).sort((a, b) => {
        const aBoosted = a.is_boosted && a.boost_expires_at && new Date(a.boost_expires_at) > new Date() ? 1 : 0;
        const bBoosted = b.is_boosted && b.boost_expires_at && new Date(b.boost_expires_at) > new Date() ? 1 : 0;
        if (bBoosted !== aBoosted) return bBoosted - aBoosted;
        // AI sort by compatibility
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
      setLoading(false);
    };
    fetchData();
  }, [user]);

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

    // Record swipe history
    await supabase.from("swipe_history").insert({
      user_id: user.id, swiped_id: currentProfile.user_id, direction
    });

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
    // Remove the like/super_like
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

  const handleShare = useCallback(() => {
    if (!currentProfile) return;
    if (navigator.share) {
      navigator.share({ title: `Check out ${currentProfile.display_name} on Spark!`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Profile link copied!");
    }
  }, [currentProfile]);

  const handleReport = useCallback(() => {
    if (!currentProfile) return;
    setReportTarget({ id: currentProfile.user_id, name: currentProfile.display_name });
  }, [currentProfile]);

  const handleSecretCrush = useCallback(async () => {
    if (!user || !currentProfile) return;
    const { error } = await supabase
      .from("secret_crushes")
      .insert({ crusher_id: user.id, crushed_id: currentProfile.user_id });
    if (error) {
      if (error.code === "23505") toast.info("Already in your crush list 💖");
      else toast.error("Failed to add secret crush");
      return;
    }
    // Check mutual
    const { data: reverse } = await supabase
      .from("secret_crushes")
      .select("id")
      .eq("crusher_id", currentProfile.user_id)
      .eq("crushed_id", user.id)
      .maybeSingle();
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
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold font-display text-foreground">Spark<span className="text-primary">.</span></h1>
        <div className="flex items-center gap-2">
          {lastSwiped && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleUndo}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9">
              <Undo2 className="h-4 w-4 text-primary" />
            </motion.button>
          )}
          {onShowFavorites && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onShowFavorites}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9">
              <Star className="h-4 w-4 text-yellow-500" />
            </motion.button>
          )}
          {onShowBookmarks && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onShowBookmarks}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9">
              <Bookmark className="h-4 w-4 text-accent" />
            </motion.button>
          )}
          <BoostSpotlight compact />
        </div>
      </div>

      <div className="px-4">
        <NearbyTonight onNavigateToChat={onNavigateToChat} />
      </div>

      <div className="px-4">
        <SpotlightProfiles />
      </div>

      <div className="px-4">
        <AIRecommendations />
      </div>

      <div className="relative mx-4 flex-1 mb-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Finding people near you...</p>
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
                />
              )).reverse()
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full gradient-love p-6 mb-4"><Sparkles className="h-10 w-10 text-primary-foreground" /></div>
                <h2 className="text-xl font-bold font-display text-foreground">No more profiles</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-[240px]">Check back later — new people join every day!</p>
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
