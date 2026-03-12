import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { computeCompatibility, type PersonalityAnswers } from "./PersonalityQuestions";
import type { Tables } from "@/integrations/supabase/types";

interface Recommendation {
  profile: Tables<"profiles">;
  score: number;
  reasons: string[];
}

interface AIRecommendationsProps {
  onViewProfile?: (profile: Tables<"profiles">) => void;
}

const AIRecommendations = ({ onViewProfile }: AIRecommendationsProps) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const generateRecommendations = async () => {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myProfile) { setLoading(false); return; }

      // Get users not yet liked
      const { data: likedData } = await supabase
        .from("likes")
        .select("liked_id")
        .eq("liker_id", user.id);

      const excludeIds = [user.id, ...(likedData?.map((l) => l.liked_id) || [])];

      const { data: candidates } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", `(${excludeIds.join(",")})`)
        .limit(50);

      if (!candidates) { setLoading(false); return; }

      // Score each candidate
      const scored: Recommendation[] = candidates.map((candidate) => {
        const compat = computeCompatibility(
          { interests: myProfile.interests, personality_answers: (myProfile.personality_answers || {}) as PersonalityAnswers },
          { interests: candidate.interests, personality_answers: (candidate.personality_answers || {}) as PersonalityAnswers }
        );

        // Boost score for nearby, online, verified users
        let bonus = 0;
        const reasons: string[] = [];

        if (compat.sharedInterests.length > 0) {
          reasons.push(`${compat.sharedInterests.length} shared interests`);
        }
        if (compat.matchedQuestions.length > 0) {
          reasons.push(`${compat.matchedQuestions.length} personality matches`);
        }
        if (candidate.is_online) {
          bonus += 5;
          reasons.push("Online now");
        }
        if ((candidate as any).is_verified) {
          bonus += 3;
          reasons.push("Verified profile");
        }

        // Location proximity bonus
        if (myProfile.latitude && myProfile.longitude && candidate.latitude && candidate.longitude) {
          const R = 6371;
          const dLat = ((candidate.latitude - myProfile.latitude) * Math.PI) / 180;
          const dLon = ((candidate.longitude - myProfile.longitude) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 +
            Math.cos((myProfile.latitude * Math.PI) / 180) *
            Math.cos((candidate.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (dist < 10) { bonus += 10; reasons.push("Very close to you"); }
          else if (dist < 50) { bonus += 5; reasons.push("Nearby"); }
        }

        if (reasons.length === 0) reasons.push("Potential match");

        return { profile: candidate, score: Math.min(compat.score + bonus, 100), reasons };
      });

      // Sort by score and take top 10
      scored.sort((a, b) => b.score - a.score);
      setRecommendations(scored.slice(0, 10));
      setLoading(false);
    };

    generateRecommendations();
  }, [user]);

  if (loading || recommendations.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-bold font-display text-foreground">Recommended For You</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {recommendations.map((rec, i) => (
          <motion.button
            key={rec.profile.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onViewProfile?.(rec.profile)}
            className="shrink-0 w-[140px] rounded-2xl bg-card border border-border overflow-hidden shadow-sm text-left"
          >
            <div className="relative h-[120px]">
              {rec.profile.avatar_url ? (
                <img src={rec.profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full gradient-love flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-foreground">
                    {rec.profile.display_name[0]}
                  </span>
                </div>
              )}
              {/* Compatibility badge */}
              <div className="absolute top-2 right-2 rounded-full gradient-love px-2 py-0.5">
                <span className="text-[10px] font-bold text-primary-foreground">{rec.score}%</span>
              </div>
              {rec.profile.is_online && (
                <span className="absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
              )}
            </div>
            <div className="p-2.5">
              <p className="text-xs font-semibold text-foreground truncate">
                {rec.profile.display_name}{rec.profile.age ? `, ${rec.profile.age}` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {rec.reasons[0]}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default AIRecommendations;
