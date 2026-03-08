import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ChatView from "./ChatView";
import type { Tables } from "@/integrations/supabase/types";

interface MatchWithProfile {
  matchId: string;
  profile: Tables<"profiles">;
  lastMessage?: string;
  lastTime?: string;
}

const MessagesView = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchWithProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchMatches = async () => {
      // Get all matches for current user
      const { data: matchData } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!matchData || matchData.length === 0) {
        setLoading(false);
        return;
      }

      // Get other user IDs
      const otherUserIds = matchData.map((m) =>
        m.user1_id === user.id ? m.user2_id : m.user1_id
      );

      // Get profiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", otherUserIds);

      // Get last message per match
      const result: MatchWithProfile[] = [];
      for (const match of matchData) {
        const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;
        const profile = profileData?.find((p) => p.user_id === otherId);
        if (!profile) continue;

        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("match_id", match.id)
          .order("created_at", { ascending: false })
          .limit(1);

        result.push({
          matchId: match.id,
          profile,
          lastMessage: lastMsg?.[0]?.content,
          lastTime: lastMsg?.[0]?.created_at
            ? new Date(lastMsg[0].created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : undefined,
        });
      }

      setMatches(result);
      setLoading(false);
    };

    fetchMatches();
  }, [user]);

  if (selectedMatch) {
    return (
      <ChatView
        matchId={selectedMatch.matchId}
        otherUserProfile={selectedMatch.profile}
        onBack={() => setSelectedMatch(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <h1 className="text-2xl font-bold font-display text-foreground mb-4">Messages</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search conversations..."
          className="w-full rounded-xl bg-muted py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center mt-10">Loading...</p>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-3">
            <MessageCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            No matches yet. Keep swiping to find your spark! ✨
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((match, i) => (
            <motion.button
              key={match.matchId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedMatch(match)}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left transition-colors hover:bg-muted shadow-card"
            >
              {match.profile.avatar_url ? (
                <img src={match.profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full gradient-love text-lg font-bold text-primary-foreground">
                  {match.profile.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-foreground">{match.profile.display_name}</span>
                  {match.lastTime && (
                    <span className="text-[10px] text-muted-foreground">{match.lastTime}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {match.lastMessage || "Say hi! 👋"}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesView;
