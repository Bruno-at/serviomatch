import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, MapPin, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Tables } from "@/integrations/supabase/types";

type SpotlightCategory = "trending" | "nearby" | "new";

interface SpotlightProfilesProps {
  onViewProfile?: (profile: Tables<"profiles">) => void;
}

const SpotlightProfiles = ({ onViewProfile }: SpotlightProfilesProps) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<SpotlightCategory>("trending");
  const [profiles, setProfiles] = useState<Tables<"profiles">[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      let query = supabase.from("profiles").select("*").neq("user_id", user.id).limit(10);

      if (category === "trending") {
        query = query.or("is_boosted.eq.true,is_spotlight.eq.true");
      } else if (category === "nearby") {
        query = query.not("latitude", "is", null);
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query;
      setProfiles(data || []);
    };

    fetch();
  }, [user, category]);

  const categories: { key: SpotlightCategory; label: string; icon: typeof Sparkles }[] = [
    { key: "trending", label: "Trending", icon: TrendingUp },
    { key: "nearby", label: "Near You", icon: MapPin },
    { key: "new", label: "New", icon: UserPlus },
  ];

  if (profiles.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Spotlight</span>
        <div className="flex gap-1 ml-auto">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
                category === c.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <c.icon className="h-2.5 w-2.5" />
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {profiles.slice(0, 8).map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onViewProfile?.(p)}
            className="flex flex-col items-center gap-1 shrink-0"
          >
            <div className="relative">
              <div className={`rounded-full p-0.5 ${
                category === "trending" ? "bg-gradient-to-br from-yellow-400 to-orange-500" : "bg-gradient-to-br from-primary to-accent"
              }`}>
                <Avatar className="h-14 w-14 border-2 border-card">
                  <AvatarImage src={p.avatar_url || ""} />
                  <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                    {p.display_name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              {p.is_online && (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
              )}
            </div>
            <span className="text-[9px] font-medium text-foreground truncate max-w-[56px]">
              {p.display_name.split(" ")[0]}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SpotlightProfiles;
