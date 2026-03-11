import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Star, Bookmark } from "lucide-react";
import ProfileCard from "./ProfileCard";
import ReportDialog from "./ReportDialog";
import CompatibilityDialog from "./CompatibilityDialog";
import MatchPopup from "./MatchPopup";
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
interface DiscoverViewProps {
  onShowFavorites?: () => void;
  onShowBookmarks?: () => void;
}

const DiscoverView = ({ onShowFavorites, onShowBookmarks }: DiscoverViewProps) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<Tables<"profiles"> | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [compatTarget, setCompatTarget] = useState<{ name: string; score: number; shared: string[]; matchedQuestions: string[] } | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch own profile for compatibility
      const { data: myData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setMyProfile(myData);

      // Get blocked users
      const { data: blockedData } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id);

      const { data: likedData } = await supabase
        .from("likes")
        .select("liked_id")
        .eq("liker_id", user.id);

      const excludeIds = [
        user.id,
        ...(likedData?.map((l) => l.liked_id) || []),
        ...(blockedData?.map((b: any) => b.blocked_id) || []),
      ];

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .limit(20);

      setProfiles(data || []);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const currentProfile = profiles[currentIndex];

  // Track profile visit
  useEffect(() => {
    if (!user || !currentProfile) return;
    supabase.from("profile_visitors").upsert(
      { visitor_id: user.id, visited_id: currentProfile.user_id },
      { onConflict: "visitor_id,visited_id" }
    );
  }, [currentProfile?.user_id, user]);

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (!user || !currentProfile) return;

      if (direction === "right") {
        await supabase.from("likes").insert({
          liker_id: user.id,
          liked_id: currentProfile.user_id,
        });

        const { data: mutual } = await supabase
          .from("likes")
          .select("id")
          .eq("liker_id", currentProfile.user_id)
          .eq("liked_id", user.id)
          .maybeSingle();

        if (mutual) {
          const [u1, u2] = [user.id, currentProfile.user_id].sort();
          const { data: matchData } = await supabase.from("matches").insert({ user1_id: u1, user2_id: u2 }).select().single();
          setMatchPopup({
            matchId: matchData?.id || "",
            matchName: currentProfile.display_name,
            matchPhoto: currentProfile.avatar_url,
          });
        } else {
          toast.success(`You liked ${currentProfile.display_name}! 💕`, { duration: 1500 });
        }
      } else {
        toast(`Passed on ${currentProfile.display_name}`, { duration: 1000 });
      }

      setCurrentIndex((prev) => prev + 1);
    },
    [currentIndex, profiles, user, currentProfile]
  );

  const handleSuperLike = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("super_likes").insert({
      liker_id: user.id,
      liked_id: currentProfile.user_id,
    });
    // Also record as a like
    await supabase.from("likes").insert({
      liker_id: user.id,
      liked_id: currentProfile.user_id,
    });
    toast.success(`🔥 Super Liked ${currentProfile.display_name}!`, { duration: 2000 });
    setCurrentIndex((prev) => prev + 1);
  }, [currentProfile, user]);

  const handleFavorite = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("favorites").insert({
      user_id: user.id,
      favorited_id: currentProfile.user_id,
    });
    toast.success(`⭐ Added ${currentProfile.display_name} to favorites`);
  }, [currentProfile, user]);

  const handleBookmark = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("bookmarks").insert({
      user_id: user.id,
      bookmarked_id: currentProfile.user_id,
    });
    toast.success(`🔖 Bookmarked ${currentProfile.display_name}`);
  }, [currentProfile, user]);

  const handleWave = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("waves").insert({
      sender_id: user.id,
      receiver_id: currentProfile.user_id,
    });
    toast.success(`👋 Waved at ${currentProfile.display_name}!`);
  }, [currentProfile, user]);

  const handleBoost = useCallback(() => {
    toast.success("⚡ Your profile is now boosted for 30 minutes!", { duration: 3000 });
  }, []);

  const handleCompliment = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("compliments").insert({
      sender_id: user.id,
      receiver_id: currentProfile.user_id,
      message: "You have a great smile 😊",
    });
    toast.success(`💬 Compliment sent to ${currentProfile.display_name}!`);
  }, [currentProfile, user]);

  const handleCompatibility = useCallback(() => {
    if (!currentProfile || !myProfile) return;
    const result = computeCompatibility(
      { interests: myProfile.interests, personality_answers: ((myProfile as any).personality_answers || {}) as PersonalityAnswers },
      { interests: currentProfile.interests, personality_answers: ((currentProfile as any).personality_answers || {}) as PersonalityAnswers }
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

  const remaining = profiles.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold font-display text-foreground">
          Spark<span className="text-primary">.</span>
        </h1>
        <div className="flex items-center gap-2">
          {onShowFavorites && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onShowFavorites}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9"
            >
              <Star className="h-4 w-4 text-yellow-500" />
            </motion.button>
          )}
          {onShowBookmarks && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onShowBookmarks}
              className="flex items-center justify-center rounded-full bg-muted h-9 w-9"
            >
              <Bookmark className="h-4 w-4 text-accent" />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleBoost}
            className="flex items-center gap-1 rounded-full gradient-love px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-card"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Boost
          </motion.button>
        </div>
      </div>

      <div className="relative mx-4 flex-1 mb-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Finding people near you...</p>
          </div>
        ) : (
          <AnimatePresence>
            {remaining.length > 0 ? (
              remaining
                .map((profile, i) => (
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
                      verified: true,
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
                ))
                .reverse()
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center text-center"
              >
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

      {reportTarget && (
        <ReportDialog
          open={!!reportTarget}
          onOpenChange={(open) => !open && setReportTarget(null)}
          targetUserId={reportTarget.id}
          targetName={reportTarget.name}
        />
      )}

      {compatTarget && (
        <CompatibilityDialog
          open={!!compatTarget}
          onClose={() => setCompatTarget(null)}
          name={compatTarget.name}
          score={compatTarget.score}
          sharedInterests={compatTarget.shared}
          matchedQuestions={compatTarget.matchedQuestions}
        />
      )}
    </div>
  );
};

export default DiscoverView;
