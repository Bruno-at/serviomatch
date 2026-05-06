import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Lock, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/hooks/usePremium";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Visitor {
  id: string;
  visitor_id: string;
  created_at: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
    age: number | null;
  };
}

const ProfileVisitorsView = () => {
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isPremium = false; // TODO: integrate with premium system

  useEffect(() => {
    if (!user) return;

    const fetchVisitors = async () => {
      const { data, count: total } = await supabase
        .from("profile_visitors")
        .select("*", { count: "exact" })
        .eq("visited_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setCount(total || 0);

      if (data && data.length > 0) {
        const visitorIds = data.map((v) => v.visitor_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, age")
          .in("user_id", visitorIds);

        const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
        setVisitors(
          data.map((v) => ({
            ...v,
            profile: profileMap.get(v.visitor_id) as Visitor["profile"],
          }))
        );
      }
      setLoading(false);
    };

    fetchVisitors();

    // Realtime visitor updates
    const channel = supabase
      .channel("profile-visitors")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profile_visitors", filter: `visited_id=eq.${user.id}` },
        async (payload) => {
          const newVisit = payload.new as any;
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_id, display_name, avatar_url, age")
            .eq("user_id", newVisit.visitor_id)
            .maybeSingle();

          setVisitors((prev) => [
            { ...newVisit, profile: profile || undefined },
            ...prev.filter((v) => v.visitor_id !== newVisit.visitor_id),
          ]);
          setCount((prev) => prev + 1);
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

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="rounded-full gradient-love p-2">
          <Eye className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Profile Visitors</h1>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "person" : "people"} viewed your profile
          </p>
        </div>
      </div>

      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4 flex items-center gap-3"
        >
          <Crown className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Upgrade to Premium</p>
            <p className="text-xs text-muted-foreground">See exactly who visited your profile</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Upgrade
          </motion.button>
        </motion.div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading visitors...</p>
        </div>
      ) : visitors.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          <div className="rounded-full bg-muted p-6 mb-4">
            <Eye className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-foreground font-semibold">No visitors yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
            Complete your profile to get more visibility
          </p>
        </motion.div>
      ) : (
        <div className="mt-4 space-y-2 overflow-y-auto flex-1 pb-24">
          {visitors.map((visitor, i) => (
            <motion.div
              key={visitor.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3 shadow-sm"
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  {isPremium ? (
                    <>
                      <AvatarImage src={visitor.profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-muted text-muted-foreground font-semibold">
                        {visitor.profile?.display_name?.[0] || "?"}
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback className="bg-muted">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {isPremium
                    ? `${visitor.profile?.display_name || "Someone"}${visitor.profile?.age ? `, ${visitor.profile.age}` : ""}`
                    : "Someone viewed you"}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(visitor.created_at)}</p>
              </div>
              <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileVisitorsView;
