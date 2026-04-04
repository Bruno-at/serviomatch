import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Lock, Trash2, Eye, Sparkles, Clock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { computeCompatibility, type PersonalityAnswers } from "./PersonalityQuestions";
import type { Tables } from "@/integrations/supabase/types";

const BASE_CRUSH_LIMIT = 5;

interface CrushEvent {
  id: string;
  title: string;
  description: string;
  emoji: string;
  event_type: string;
  start_time: string;
  end_time: string;
  crush_limit_override: number | null;
  reveal_mutual: boolean;
}

type EventStatus = "live" | "upcoming" | "ended";

const getEventStatus = (event: CrushEvent): EventStatus => {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";
  return "ended";
};

const formatCountdown = (targetDate: Date): string => {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return "Now!";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};

interface SecretCrushViewProps {
  onBack?: () => void;
  onViewProfile?: (profile: Tables<"profiles">) => void;
  onNavigateToChat?: (matchId: string, profile: Tables<"profiles">) => void;
}

const SecretCrushView = ({ onBack, onViewProfile, onNavigateToChat }: SecretCrushViewProps) => {
  const { user } = useAuth();
  const [crushes, setCrushes] = useState<(Tables<"profiles"> & { crush_id: string; is_mutual: boolean })[]>([]);
  const [suggestions, setSuggestions] = useState<(Tables<"profiles"> & { reason: string; score: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutualPopup, setMutualPopup] = useState<Tables<"profiles"> | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "suggestions" | "events">("list");
  const [events, setEvents] = useState<CrushEvent[]>([]);
  const [countdownTick, setCountdownTick] = useState(0);

  // Tick every second for countdown timers
  useEffect(() => {
    const interval = setInterval(() => setCountdownTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate dynamic crush limit based on active events
  const crushLimit = useMemo(() => {
    const activeOverride = events
      .filter(e => getEventStatus(e) === "live" && e.crush_limit_override)
      .map(e => e.crush_limit_override!)
      .sort((a, b) => b - a)[0];
    return activeOverride || BASE_CRUSH_LIMIT;
  }, [events, countdownTick]);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from("crush_events")
      .select("*")
      .order("start_time", { ascending: true });
    if (data) setEvents(data as CrushEvent[]);
  }, []);

  const fetchCrushes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("secret_crushes")
      .select("id, crushed_id, is_mutual")
      .eq("crusher_id", user.id);

    if (!data || data.length === 0) {
      setCrushes([]);
      setLoading(false);
      return;
    }

    const ids = data.map(c => c.crushed_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", ids);

    if (profiles) {
      const mapped = profiles.map(p => {
        const crush = data.find(c => c.crushed_id === p.user_id)!;
        return { ...p, crush_id: crush.id, is_mutual: crush.is_mutual };
      });
      setCrushes(mapped);
    }
    setLoading(false);
  }, [user]);

  const fetchSuggestions = useCallback(async () => {
    if (!user) return;
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!myProfile) return;

    const { data: visited } = await supabase
      .from("profile_visitors")
      .select("visited_id")
      .eq("visitor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: existingCrushes } = await supabase
      .from("secret_crushes")
      .select("crushed_id")
      .eq("crusher_id", user.id);

    const excludeIds = [user.id, ...(existingCrushes?.map(c => c.crushed_id) || [])];
    const visitedIds = visited?.map(v => v.visited_id).filter(id => !excludeIds.includes(id)) || [];

    const { data: candidates } = await supabase
      .from("profiles")
      .select("*")
      .not("user_id", "in", `(${excludeIds.join(",")})`)
      .limit(30);

    if (!candidates) return;

    const scored = candidates.map(candidate => {
      const compat = computeCompatibility(
        { interests: myProfile.interests, personality_answers: (myProfile.personality_answers || {}) as PersonalityAnswers },
        { interests: candidate.interests, personality_answers: (candidate.personality_answers || {}) as PersonalityAnswers }
      );

      let bonus = 0;
      const reasons: string[] = [];

      if (visitedIds.includes(candidate.user_id)) { bonus += 15; reasons.push("You viewed their profile"); }
      if (compat.sharedInterests.length > 0) reasons.push(`${compat.sharedInterests.length} shared interests`);
      if (candidate.is_online) { bonus += 5; reasons.push("Online now"); }
      if (compat.matchedQuestions.length > 0) { bonus += 5; reasons.push("Personality match"); }
      if (reasons.length === 0) reasons.push("Potential match");

      return { ...candidate, reason: reasons[0], score: Math.min(compat.score + bonus, 100) };
    });

    scored.sort((a, b) => b.score - a.score);
    setSuggestions(scored.slice(0, 10));
  }, [user]);

  // Check for midnight match hour reveal
  const checkMidnightReveal = useCallback(async () => {
    if (!user) return;
    const midnightEvent = events.find(e => e.event_type === "midnight_match_hour" && getEventStatus(e) === "live" && e.reveal_mutual);
    if (!midnightEvent) return;

    // Fetch non-mutual crushes where reverse exists
    const { data: myCrushes } = await supabase
      .from("secret_crushes")
      .select("id, crushed_id")
      .eq("crusher_id", user.id)
      .eq("is_mutual", false);

    if (!myCrushes || myCrushes.length === 0) return;

    for (const crush of myCrushes) {
      const { data: reverse } = await supabase
        .from("secret_crushes")
        .select("id")
        .eq("crusher_id", crush.crushed_id)
        .eq("crushed_id", user.id)
        .maybeSingle();

      if (reverse) {
        await supabase.from("secret_crushes").update({ is_mutual: true }).eq("id", crush.id);
        await supabase.from("secret_crushes").update({ is_mutual: true }).eq("id", reverse.id);
        await supabase.from("matches").insert({ user1_id: user.id, user2_id: crush.crushed_id });
        toast.success("💖 Your Secret Crush has been revealed!");
      }
    }
    fetchCrushes();
  }, [user, events, fetchCrushes]);

  useEffect(() => {
    fetchEvents();
    fetchCrushes();
    fetchSuggestions();
  }, [user]);

  // Run midnight reveal check when events are loaded and periodically
  useEffect(() => {
    if (events.length > 0) checkMidnightReveal();
  }, [events, checkMidnightReveal]);

  const addCrush = async (profile: Tables<"profiles">) => {
    if (!user) return;
    if (crushes.length >= crushLimit) {
      toast.error(`You can only have ${crushLimit} secret crushes`);
      return;
    }
    if (crushes.some(c => c.user_id === profile.user_id)) {
      toast.info("Already in your crush list");
      return;
    }

    const { error } = await supabase
      .from("secret_crushes")
      .insert({ crusher_id: user.id, crushed_id: profile.user_id });

    if (error) { toast.error("Failed to add crush"); return; }

    const { data: reverse } = await supabase
      .from("secret_crushes")
      .select("id")
      .eq("crusher_id", profile.user_id)
      .eq("crushed_id", user.id)
      .maybeSingle();

    if (reverse) {
      await supabase.from("secret_crushes").update({ is_mutual: true }).eq("crusher_id", user.id).eq("crushed_id", profile.user_id);
      await supabase.from("secret_crushes").update({ is_mutual: true }).eq("crusher_id", profile.user_id).eq("crushed_id", user.id);
      await supabase.from("matches").insert({ user1_id: user.id, user2_id: profile.user_id });
      setMutualPopup(profile);
      toast.success("It's a Secret Match! 💖");
    } else {
      toast.success("Added to your secret crushes 💖🔒");
    }

    fetchCrushes();
    fetchSuggestions();
  };

  const removeCrush = async (crushId: string) => {
    await supabase.from("secret_crushes").delete().eq("id", crushId);
    toast.success("Crush removed");
    fetchCrushes();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Heart className="h-6 w-6 text-pink-500" />
              <Lock className="h-3 w-3 text-pink-400 absolute -bottom-0.5 -right-0.5" />
            </div>
            <h1 className="text-lg font-bold font-display text-foreground">Secret Crush</h1>
          </div>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {crushes.length}/{crushLimit}
            {crushLimit > BASE_CRUSH_LIMIT && <span className="text-pink-500 ml-1">⚡</span>}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {([
            { id: "list" as const, label: "My Crushes", icon: Heart },
            { id: "suggestions" as const, label: "AI Picks", icon: Sparkles },
            { id: "events" as const, label: "Events", icon: Clock },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-pink-500/10 text-pink-500 border border-pink-500/20"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === "events" && events.some(e => getEventStatus(e) === "live") && (
                <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === "list" && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : crushes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="relative">
                    <Heart className="h-16 w-16 text-muted-foreground/30" />
                    <Lock className="h-8 w-8 text-muted-foreground/30 absolute -bottom-1 -right-1" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    No secret crushes yet.<br />Add someone from the AI Picks tab!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {crushes.map((crush, i) => (
                    <motion.div
                      key={crush.crush_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-2xl border ${
                        crush.is_mutual ? "bg-pink-500/5 border-pink-500/20" : "bg-card border-border"
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={crush.avatar_url || ""} />
                          <AvatarFallback className="gradient-love text-primary-foreground font-bold">
                            {crush.display_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        {crush.is_mutual ? (
                          <span className="absolute -top-1 -right-1 text-sm">💖</span>
                        ) : (
                          <Lock className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-pink-400 bg-card rounded-full p-0.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {crush.display_name}{crush.age ? `, ${crush.age}` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {crush.is_mutual ? "💖 It's mutual!" : "🔒 Secret — only you can see this"}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {crush.is_mutual && (
                          <button onClick={() => onViewProfile?.(crush)} className="p-2 rounded-full bg-pink-500/10 text-pink-500">
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => removeCrush(crush.crush_id)} className="p-2 rounded-full bg-destructive/10 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "suggestions" && (
            <motion.div key="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-accent" />
                <p className="text-xs text-muted-foreground">AI picks based on your activity, interests & compatibility</p>
              </div>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Use the app more to get AI suggestions!</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {suggestions.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-2xl bg-card border border-border overflow-hidden"
                    >
                      <div className="relative h-[100px]">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full gradient-love flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary-foreground">{s.display_name[0]}</span>
                          </div>
                        )}
                        <div className="absolute top-1.5 right-1.5 rounded-full bg-accent/90 px-1.5 py-0.5">
                          <span className="text-[9px] font-bold text-accent-foreground">{s.score}%</span>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold text-foreground truncate">{s.display_name}{s.age ? `, ${s.age}` : ""}</p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{s.reason}</p>
                        <Button size="sm" onClick={() => addCrush(s)} className="w-full mt-2 h-7 text-[10px] bg-pink-500 hover:bg-pink-600 text-white">
                          <Heart className="h-3 w-3 mr-1" /> Add Crush
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "events" && (
            <motion.div key="events" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No events scheduled yet.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event, i) => {
                    const status = getEventStatus(event);
                    const startDate = new Date(event.start_time);
                    const endDate = new Date(event.end_time);

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`p-4 rounded-2xl border transition-all ${
                          status === "live"
                            ? "bg-pink-500/5 border-pink-500/20 shadow-lg shadow-pink-500/5"
                            : status === "upcoming"
                            ? "bg-card border-accent/20"
                            : "bg-muted/30 border-border opacity-60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <motion.span
                            className="text-2xl"
                            animate={status === "live" ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          >
                            {event.emoji}
                          </motion.span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{event.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>

                            {/* Event details */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {event.crush_limit_override && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-500">
                                  ⚡ {event.crush_limit_override} crushes
                                </span>
                              )}
                              {event.reveal_mutual && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                                  👁 Reveals mutual crushes
                                </span>
                              )}
                            </div>

                            {/* Countdown for upcoming */}
                            {status === "upcoming" && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-accent" />
                                <span className="text-[11px] font-medium text-accent">
                                  Starts in {formatCountdown(startDate)}
                                </span>
                              </div>
                            )}

                            {/* Time remaining for live */}
                            {status === "live" && (
                              <div className="mt-2 flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-pink-500" />
                                <span className="text-[11px] font-medium text-pink-500">
                                  Ends in {formatCountdown(endDate)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Status badge */}
                          {status === "live" ? (
                            <span className="text-[10px] font-bold text-white bg-pink-500 px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-pink-500/30">
                              LIVE
                            </span>
                          ) : status === "upcoming" ? (
                            <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-1 rounded-full">
                              UPCOMING
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              ENDED
                            </span>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mutual Match Popup */}
      <AnimatePresence>
        {mutualPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
            onClick={() => setMutualPopup(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-card rounded-3xl p-8 text-center max-w-sm w-full border border-pink-500/20 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-6xl mb-4">💖</motion.div>
              <h2 className="text-xl font-bold font-display text-foreground mb-1">It's a Secret Match!</h2>
              <p className="text-sm text-muted-foreground mb-4">
                You and <span className="font-semibold text-pink-500">{mutualPopup.display_name}</span> both added each other as secret crushes!
              </p>
              <Avatar className="h-20 w-20 mx-auto mb-4 ring-4 ring-pink-500/30">
                <AvatarImage src={mutualPopup.avatar_url || ""} />
                <AvatarFallback className="gradient-love text-primary-foreground text-2xl font-bold">{mutualPopup.display_name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setMutualPopup(null)}>Later</Button>
                <Button className="flex-1 bg-pink-500 hover:bg-pink-600 text-white" onClick={() => setMutualPopup(null)}>Say Hi 💬</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SecretCrushView;
