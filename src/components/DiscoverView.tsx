import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import ProfileCard from "./ProfileCard";
import ReportDialog from "./ReportDialog";
import CompatibilityDialog from "./CompatibilityDialog";
import MatchPopup from "./MatchPopup";
import FiltersDialog from "./FiltersDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { computeCompatibility, type PersonalityAnswers } from "./PersonalityQuestions";
import {
  DEFAULT_FILTERS, type DiscoverFilters, countActiveFilters,
} from "@/lib/filterOptions";
import { likeUser, unlikeUser } from "@/lib/likes";


interface DiscoverViewProps {
  onShowFavorites?: () => void;
  onShowBookmarks?: () => void;
  onNavigateToChat?: (matchId: string, profile: Tables<"profiles">) => void;
}

const FILTERS_STORAGE_KEY = "spark:discover-filters:v2";

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
  const [filters, setFilters] = useState<DiscoverFilters>(() => {
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_FILTERS;
  });
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = countActiveFilters(filters);

  // Hydrate filter preferences from server (overrides local on first load)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("user_filter_preferences")
        .select("filters")
        .eq("user_id", user.id)
        .maybeSingle();
      const saved = (data as any)?.filters;
      if (!cancelled && saved) {
        setFilters({ ...DEFAULT_FILTERS, ...(saved as Partial<DiscoverFilters>) });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

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

      let query = supabase.from("profiles").select("*").not("user_id", "in", `(${excludeIds.join(",")})`).limit(80);

      // Basics
      query = query.gte("age", filters.ageRange[0]).lte("age", filters.ageRange[1]);
      if (filters.onlineOnly) query = query.eq("is_online", true);
      if (filters.gender !== "all") query = query.eq("gender", filters.gender);

      // Popular
      if (filters.country) query = query.ilike("country", filters.country);
      if (filters.continent) query = query.eq("continent", filters.continent);
      // Height: only enforce if narrowed from defaults
      if (filters.heightRange[0] !== DEFAULT_FILTERS.heightRange[0]
        || filters.heightRange[1] !== DEFAULT_FILTERS.heightRange[1]) {
        query = query.gte("height_cm", filters.heightRange[0]).lte("height_cm", filters.heightRange[1]);
      }
      if (filters.sexuality.length) query = query.in("sexuality", filters.sexuality);
      if (filters.goals.length) query = query.overlaps("dating_intents", filters.goals);
      if (filters.starSigns.length) query = query.in("star_sign", filters.starSigns);
      if (filters.languages.length) query = query.overlaps("languages", filters.languages);

      // Lifestyle
      if (filters.children.length) query = query.in("children", filters.children);
      if (filters.pets.length) query = query.overlaps("pets", filters.pets);
      if (filters.smoking.length) query = query.in("smoking", filters.smoking);
      if (filters.drinking.length) query = query.in("drinking", filters.drinking);
      if (filters.education.length) query = query.in("education", filters.education);
      if (filters.relationshipStatus.length) query = query.in("relationship_status", filters.relationshipStatus);
      if (filters.religion.length) query = query.in("religion", filters.religion);
      if (filters.occupation.length) query = query.in("occupation", filters.occupation);
      if (filters.fitness.length) query = query.in("fitness", filters.fitness);
      if (filters.diet.length) query = query.in("diet", filters.diet);
      if (filters.interests.length) query = query.overlaps("interests", filters.interests);
      if (filters.sleepSchedule.length) query = query.in("sleep_schedule", filters.sleepSchedule);
      if (filters.ethnicity.length) query = query.in("ethnicity", filters.ethnicity);

      // Personality
      if (filters.personality.length) query = query.overlaps("personality_traits", filters.personality);

      const { data } = await query;

      // Deduplicate by user_id just in case
      const seen = new Set<string>();
      const unique = (data || []).filter((p) => {
        if (seen.has(p.user_id)) return false;
        seen.add(p.user_id);
        return true;
      });

      const sorted = unique.sort((a, b) => {
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
  }, [user, filters]);

  const currentProfile = profiles[currentIndex];

  useEffect(() => {
    if (!user || !currentProfile) return;
    supabase.from("profile_visitors").upsert(
      { visitor_id: user.id, visited_id: currentProfile.user_id },
      { onConflict: "visitor_id,visited_id" }
    );
  }, [currentProfile?.user_id, user]);

  const applyFilters = useCallback(async (next: DiscoverFilters) => {
    setFilters(next);
    setShowFilters(false);
    try { localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(next)); } catch {}
    if (user) {
      await (supabase as any).from("user_filter_preferences").upsert(
        { user_id: user.id, filters: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }
    const active = countActiveFilters(next);
    toast.success(active > 0 ? `Applied ${active} filter${active === 1 ? "" : "s"}` : "Filters reset");
  }, [user]);

  const handleSwipe = useCallback(async (direction: "left" | "right") => {
    if (!user || !currentProfile) return;
    await supabase.from("swipe_history").insert({ user_id: user.id, swiped_id: currentProfile.user_id, direction });
    setLastSwiped({ profile: currentProfile, direction });

    if (direction === "right") {
      const res = await likeUser(user.id, currentProfile.user_id);
      if (!res.ok) {
        toast.error(res.error);
      } else if (res.matched) {
        setMatchPopup({ matchId: res.matchId || "", matchName: currentProfile.display_name, matchPhoto: currentProfile.avatar_url });
      } else {
        toast.success(`You liked ${currentProfile.display_name}! 💕`, { duration: 1500 });
      }
    } else {
      toast(`Passed on ${currentProfile.display_name}`, { duration: 1000 });
    }

    setCurrentIndex((prev) => prev + 1);
  }, [user, currentProfile]);

  const handleUndo = useCallback(async () => {
    if (!lastSwiped || !user) return;
    const target = lastSwiped.profile.user_id;
    await Promise.all([
      supabase.from("likes").delete().eq("liker_id", user.id).eq("liked_id", target),
      supabase.from("super_likes").delete().eq("liker_id", user.id).eq("liked_id", target),
      supabase.from("bookmarks").delete().eq("user_id", user.id).eq("bookmarked_id", target),
      supabase.from("swipe_history").delete().eq("user_id", user.id).eq("swiped_id", target),
    ]);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    setUndoCount((prev) => prev + 1);
    setLastSwiped(null);
    toast.success(`↩️ Brought back ${lastSwiped.profile.display_name}`);
  }, [lastSwiped, user, undoCount]);

  const handleWave = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("waves").insert({ sender_id: user.id, receiver_id: currentProfile.user_id });
    toast.success(`👋 Waved at ${currentProfile.display_name}!`);
  }, [currentProfile, user]);

  const handleCompliment = useCallback(async () => {
    if (!user || !currentProfile) return;
    await supabase.from("compliments").insert({ sender_id: user.id, receiver_id: currentProfile.user_id, message: "You have a great smile 😊" });
    toast.success(`💬 Compliment sent to ${currentProfile.display_name}!`);
  }, [currentProfile, user]);

  const remaining = profiles.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground leading-none">
            Discover
          </h1>
          <p className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            People near you
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowFilters(true)}
            className="relative flex items-center gap-1.5 rounded-full bg-foreground text-background h-10 px-4 hover:opacity-90 transition-opacity shadow-sm"
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-xs font-semibold">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background text-foreground text-[10px] font-bold px-1.5">
                {activeFilterCount}
              </span>
            )}
          </motion.button>
        </div>
      </div>

      <FiltersDialog
        open={showFilters}
        onOpenChange={setShowFilters}
        initial={filters}
        onApply={applyFilters}
      />

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
              remaining.map((profile, i) => {
                const intents = (profile as any).dating_intents as string[] | null;
                const goal = intents?.[0] || (profile as any).looking_for || undefined;
                const country = (profile as any).country || profile.location?.split(",").pop()?.trim();
                const createdAt = (profile as any).created_at as string | undefined;
                const ageMs = createdAt ? Date.now() - new Date(createdAt).getTime() : Infinity;
                const isNew = ageMs < 7 * 24 * 60 * 60 * 1000;
                const GOAL_EMOJI: Record<string, string> = {
                  "Here to Date": "❤️",
                  "Ready for a Relationship": "💍",
                  "Here to Make Friends": "👫",
                  "Open to Chat": "💬",
                  "Casual Dating": "🌟",
                  "Marriage": "💒",
                  "Networking": "🤝",
                };
                const badgeText = isNew
                  ? "🆕 Just Joined"
                  : goal
                  ? `${GOAL_EMOJI[goal] || "✨"} ${goal}`
                  : undefined;
                const city = (profile as any).city as string | undefined;
                const locationLabel = [city, country].filter(Boolean).join(", ") || profile.location || undefined;
                return (
                  <ProfileCard
                    key={profile.id}
                    profile={{
                      id: profile.id,
                      name: profile.display_name,
                      age: profile.age || 0,
                      distance: "Nearby",
                      location: locationLabel,
                      country,
                      intent: badgeText,
                      bio: profile.bio || "",
                      image: profile.avatar_url || (profile.photos?.[0] ?? ""),
                      photos: (profile.photos && profile.photos.length > 0)
                        ? profile.photos
                        : (profile.avatar_url ? [profile.avatar_url] : []),
                      interests: profile.interests || [],
                      prompts: [],
                      verified: !!profile.is_verified,
                      details: {
                        occupation: (profile as any).occupation,
                        education: (profile as any).education,
                        city,
                        languages: (profile as any).languages,
                        religion: (profile as any).religion,
                        pets: (profile as any).pets,
                        children: (profile as any).children,
                        smoking: (profile as any).smoking,
                        drinking: (profile as any).drinking,
                        fitness: (profile as any).fitness,
                        diet: (profile as any).diet,
                        relationship_status: (profile as any).relationship_status,
                        sleep_schedule: (profile as any).sleep_schedule,
                        height_cm: (profile as any).height_cm,
                        ethnicity: (profile as any).ethnicity,
                        star_sign: (profile as any).star_sign,
                        personality_traits: (profile as any).personality_traits,
                        goal,
                        avatar_url: profile.avatar_url,
                      },
                    }}
                    isTop={i === 0}
                    onSwipeLeft={() => handleSwipe("left")}
                    onSwipeRight={() => handleSwipe("right")}
                    onUndo={handleUndo}
                    canUndo={!!lastSwiped}
                    onWave={handleWave}
                    onCompliment={handleCompliment}
                  />
                );
              }).reverse()

            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full gradient-love p-6 mb-4">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold font-display text-foreground">No matches found</h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-[260px]">
                  {activeFilterCount > 0
                    ? "Try widening your filters to see more people."
                    : "Check back later — new people join every day!"}
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => applyFilters(DEFAULT_FILTERS)}
                    className="mt-4 rounded-full bg-foreground text-background px-4 py-2 text-xs font-semibold hover:opacity-90"
                  >
                    Clear all filters
                  </button>
                )}
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
