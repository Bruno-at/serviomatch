import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import ProfileCard from "./ProfileCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const DiscoverView = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchProfiles = async () => {
      // Get users already liked/passed
      const { data: likedData } = await supabase
        .from("likes")
        .select("liked_id")
        .eq("liker_id", user.id);

      const excludeIds = [user.id, ...(likedData?.map((l) => l.liked_id) || [])];

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .limit(20);

      setProfiles(data || []);
      setLoading(false);
    };

    fetchProfiles();
  }, [user]);

  const handleSwipe = useCallback(
    async (direction: "left" | "right") => {
      if (!user) return;
      const profile = profiles[currentIndex];
      if (!profile) return;

      if (direction === "right") {
        // Record the like
        await supabase.from("likes").insert({
          liker_id: user.id,
          liked_id: profile.user_id,
        });

        // Check if mutual like (match!)
        const { data: mutual } = await supabase
          .from("likes")
          .select("id")
          .eq("liker_id", profile.user_id)
          .eq("liked_id", user.id)
          .maybeSingle();

        if (mutual) {
          // Create match (lower ID first for uniqueness)
          const [u1, u2] = [user.id, profile.user_id].sort();
          await supabase.from("matches").insert({ user1_id: u1, user2_id: u2 });
          toast.success(`It's a match with ${profile.display_name}! 🎉`, { duration: 3000 });
        } else {
          toast.success(`You liked ${profile.display_name}! 💕`, { duration: 1500 });
        }
      } else {
        toast(`Passed on ${profile.display_name}`, { duration: 1000 });
      }

      setCurrentIndex((prev) => prev + 1);
    },
    [currentIndex, profiles, user]
  );

  const remaining = profiles.slice(currentIndex, currentIndex + 2);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold font-display text-foreground">
          Spark<span className="text-primary">.</span>
        </h1>
        <motion.button
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1 rounded-full gradient-love px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-card"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Boost
        </motion.button>
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
    </div>
  );
};

export default DiscoverView;
