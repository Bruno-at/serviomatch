import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Phone, Video, Star, UserX, ShieldAlert,
  Filter, SortAsc, MapPin, Clock, Wifi, Search, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import ChatView from "./ChatView";
import CallView from "./CallView";
import ReportDialog from "./ReportDialog";
import MatchStreak from "./MatchStreak";
import MatchExpirationTimer from "./MatchExpirationTimer";
import CompatibilityMeter from "./CompatibilityMeter";
import SmartConversationStarters from "./SmartConversationStarters";
import { computeCompatibility, type PersonalityAnswers } from "./PersonalityQuestions";
import { reverseGeocode, openInGoogleMaps } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

interface MatchEntry {
  matchId: string;
  matchedAt: string;
  profile: Tables<"profiles">;
  lastMessage?: string;
  hasNewMessage?: boolean;
  streakCount: number;
  compatibilityScore: number;
  sharedInterests: string[];
}

type SortOption = "newest" | "active" | "compatibility" | "streak";
type FilterOption = "all" | "online" | "favorites" | "recent";

const MatchesView = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<{ matchId: string; profile: Tables<"profiles"> } | null>(null);
  const [activeCall, setActiveCall] = useState<{ matchId: string; profile: Tables<"profiles">; mode: "audio" | "video" } | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("compatibility");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [myProfile, setMyProfile] = useState<Tables<"profiles"> | null>(null);
  const [showStarters, setShowStarters] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!user) return;

    const [{ data: myData }, { data: matchData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("matches").select("*").or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).order("created_at", { ascending: false }),
    ]);

    setMyProfile(myData);

    if (!matchData || matchData.length === 0) { setLoading(false); return; }

    const otherUserIds = matchData.map((m) => m.user1_id === user.id ? m.user2_id : m.user1_id);

    const [{ data: profileData }, { data: favData }, { data: streakData }] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", otherUserIds),
      supabase.from("favorites").select("favorited_id").eq("user_id", user.id),
      supabase.from("match_streaks").select("*").in("match_id", matchData.map((m) => m.id)),
    ]);

    setFavoriteIds(new Set(favData?.map((f) => f.favorited_id) || []));

    const result: MatchEntry[] = [];
    for (const match of matchData) {
      const otherId = match.user1_id === user.id ? match.user2_id : match.user1_id;
      const profile = profileData?.find((p) => p.user_id === otherId);
      if (!profile) continue;

      const { data: lastMsg } = await supabase.from("messages").select("content")
        .eq("match_id", match.id).order("created_at", { ascending: false }).limit(1);

      const streak = streakData?.find((s: any) => s.match_id === match.id);
      const compat = myData ? computeCompatibility(
        { interests: myData.interests, personality_answers: (myData.personality_answers || {}) as PersonalityAnswers },
        { interests: profile.interests, personality_answers: (profile.personality_answers || {}) as PersonalityAnswers }
      ) : { score: 50, sharedInterests: [], matchedQuestions: [] };

      result.push({
        matchId: match.id,
        matchedAt: match.created_at,
        profile,
        lastMessage: lastMsg?.[0]?.content,
        streakCount: (streak as any)?.streak_count || 0,
        compatibilityScore: compat.score,
        sharedInterests: compat.sharedInterests,
      });
    }

    setMatches(result);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel("matches-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, (payload) => {
        const n = payload.new as Tables<"matches">;
        if (n.user1_id === user.id || n.user2_id === user.id) fetchMatches();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchMatches]);

  const handleUnmatch = async (matchId: string, name: string) => {
    toast.success(`Unmatched with ${name}`);
    setMatches((prev) => prev.filter((m) => m.matchId !== matchId));
  };

  const handleFavorite = async (profileUserId: string) => {
    if (!user) return;
    if (favoriteIds.has(profileUserId)) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("favorited_id", profileUserId);
      setFavoriteIds((prev) => { const n = new Set(prev); n.delete(profileUserId); return n; });
      toast("Removed from favorites");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, favorited_id: profileUserId });
      setFavoriteIds((prev) => new Set(prev).add(profileUserId));
      toast.success("⭐ Added to favorites");
    }
  };

  const handleSendStarter = async (matchId: string, message: string) => {
    if (!user) return;
    await supabase.from("messages").insert({ match_id: matchId, sender_id: user.id, content: message });
    toast.success("Message sent! 💬");
    setShowStarters(null);
  };

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  let filtered = matches.filter((m) => m.profile.display_name.toLowerCase().includes(search.toLowerCase()));
  if (filterBy === "online") filtered = filtered.filter((m) => m.profile.is_online);
  if (filterBy === "favorites") filtered = filtered.filter((m) => favoriteIds.has(m.profile.user_id));
  if (filterBy === "recent") {
    const oneDayAgo = Date.now() - 86400000;
    filtered = filtered.filter((m) => new Date(m.matchedAt).getTime() > oneDayAgo);
  }

  if (sortBy === "newest") filtered.sort((a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime());
  if (sortBy === "active") filtered.sort((a, b) => (b.profile.is_online ? 1 : 0) - (a.profile.is_online ? 1 : 0));
  if (sortBy === "compatibility") filtered.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  if (sortBy === "streak") filtered.sort((a, b) => b.streakCount - a.streakCount);

  if (activeCall) {
    return <CallView matchId={activeCall.matchId} otherUserProfile={activeCall.profile} mode={activeCall.mode} onEnd={() => setActiveCall(null)} />;
  }

  if (selectedChat) {
    return <ChatView matchId={selectedChat.matchId} otherUserProfile={selectedChat.profile} onBack={() => setSelectedChat(null)} />;
  }

  // Top matches (AI ranked)
  const topMatches = [...matches].sort((a, b) => b.compatibilityScore - a.compatibilityScore).slice(0, 5);

  const filterOptions: { key: FilterOption; label: string; icon: typeof Heart }[] = [
    { key: "all", label: "All", icon: Heart },
    { key: "online", label: "Online", icon: Wifi },
    { key: "recent", label: "Recent", icon: Clock },
    { key: "favorites", label: "Favorites", icon: Star },
  ];
  const sortOptions: { key: SortOption; label: string }[] = [
    { key: "compatibility", label: "Best Match" },
    { key: "newest", label: "Newest" },
    { key: "active", label: "Most Active" },
    { key: "streak", label: "Streaks" },
  ];

  return (
    <div className="flex h-full flex-col px-6 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Matches</h1>
          <p className="text-sm text-muted-foreground">{matches.length} {matches.length === 1 ? "match" : "matches"}</p>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            showFilters ? "gradient-love text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
          <Filter className="h-3 w-3" /> Filter
        </motion.button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search matches..."
          className="w-full rounded-xl bg-muted py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <div className="flex gap-2 mb-2">
              {filterOptions.map((f) => (
                <button key={f.key} onClick={() => setFilterBy(f.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filterBy === f.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                  }`}>
                  <f.icon className="h-3 w-3" />{f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <SortAsc className="h-3 w-3 text-muted-foreground" />
              {sortOptions.map((s) => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    sortBy === s.key ? "bg-primary/15 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                  }`}>{s.label}</button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Matches For You */}
      {topMatches.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Top Matches For You
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {topMatches.map((match, i) => (
              <motion.button key={match.matchId}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedChat({ matchId: match.matchId, profile: match.profile })}
                className="flex flex-col items-center gap-1 shrink-0">
                <div className="relative">
                  <div className="rounded-full p-0.5 gradient-love">
                    <Avatar className="h-16 w-16 border-2 border-card">
                      <AvatarImage src={match.profile.avatar_url || ""} />
                      <AvatarFallback className="bg-muted text-muted-foreground font-bold text-lg">{match.profile.display_name[0]}</AvatarFallback>
                    </Avatar>
                  </div>
                  {match.profile.is_online && <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card" />}
                </div>
                <span className="text-[10px] font-medium text-foreground truncate max-w-[64px]">{match.profile.display_name.split(" ")[0]}</span>
                <CompatibilityMeter score={match.compatibilityScore} compact />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Match list */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center"><p className="text-sm text-muted-foreground">Loading matches...</p></div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="rounded-full gradient-love p-6 mb-4"><Heart className="h-8 w-8 text-primary-foreground" /></div>
          <p className="text-foreground font-semibold font-display">{search || filterBy !== "all" ? "No matches found" : "No matches yet"}</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[220px]">{search || filterBy !== "all" ? "Try adjusting your filters" : "Keep swiping to find your perfect match!"}</p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto flex-1 pb-24">
          {filtered.map((match, i) => (
            <motion.div key={match.matchId} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }} className="rounded-2xl bg-card border border-border p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={match.profile.avatar_url || ""} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-bold text-lg">{match.profile.display_name[0]}</AvatarFallback>
                  </Avatar>
                  {match.profile.is_online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {match.profile.display_name}{match.profile.age ? `, ${match.profile.age}` : ""}
                    </p>
                    {favoriteIds.has(match.profile.user_id) && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                    <MatchStreak count={match.streakCount} compact />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${match.profile.is_online ? "text-green-500" : "text-muted-foreground"}`}>
                      {match.profile.is_online ? "Online now" : match.profile.last_online ? `Active ${timeAgo(match.profile.last_online)}` : `Matched ${timeAgo(match.matchedAt)}`}
                    </span>
                    <MatchExpirationTimer matchedAt={match.matchedAt} hasMessages={!!match.lastMessage} />
                  </div>
                  {/* Compatibility bar */}
                  <div className="mt-1">
                    <CompatibilityMeter score={match.compatibilityScore} />
                  </div>
                  {match.lastMessage && <p className="text-xs text-muted-foreground truncate mt-0.5">💬 {match.lastMessage}</p>}
                </div>
              </div>

              {/* Smart Conversation Starters */}
              <AnimatePresence>
                {showStarters === match.matchId && !match.lastMessage && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2">
                    <SmartConversationStarters
                      sharedInterests={match.sharedInterests}
                      matchName={match.profile.display_name}
                      onSelect={(msg) => handleSendStarter(match.matchId, msg)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border">
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    if (!match.lastMessage) { setShowStarters(showStarters === match.matchId ? null : match.matchId); }
                    else { setSelectedChat({ matchId: match.matchId, profile: match.profile }); }
                  }}
                  className="flex items-center gap-1 rounded-xl gradient-love px-3 py-1.5 text-xs font-semibold text-primary-foreground flex-1 justify-center">
                  <MessageCircle className="h-3.5 w-3.5" />{!match.lastMessage ? "Break the Ice" : "Message"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveCall({ matchId: match.matchId, profile: match.profile, mode: "audio" })}
                  className="flex items-center justify-center rounded-xl bg-muted h-8 w-8"><Phone className="h-3.5 w-3.5 text-muted-foreground" /></motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setActiveCall({ matchId: match.matchId, profile: match.profile, mode: "video" })}
                  className="flex items-center justify-center rounded-xl bg-muted h-8 w-8"><Video className="h-3.5 w-3.5 text-muted-foreground" /></motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleFavorite(match.profile.user_id)}
                  className={`flex items-center justify-center rounded-xl h-8 w-8 ${favoriteIds.has(match.profile.user_id) ? "bg-yellow-500/15" : "bg-muted"}`}>
                  <Star className={`h-3.5 w-3.5 ${favoriteIds.has(match.profile.user_id) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setReportTarget({ id: match.profile.user_id, name: match.profile.display_name })}
                  className="flex items-center justify-center rounded-xl bg-muted h-8 w-8"><ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" /></motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleUnmatch(match.matchId, match.profile.display_name)}
                  className="flex items-center justify-center rounded-xl bg-destructive/10 h-8 w-8"><UserX className="h-3.5 w-3.5 text-destructive" /></motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {reportTarget && (
        <ReportDialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}
          targetUserId={reportTarget.id} targetName={reportTarget.name} />
      )}
    </div>
  );
};

export default MatchesView;
