import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Heart, X, Zap, ArrowLeft, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const ROUND_SECONDS = 180; // 3 minutes

const SpeedDating = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<"lobby" | "matching" | "session" | "feedback">("lobby");
  const [partner, setPartner] = useState<Tables<"profiles"> | null>(null);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [liked, setLiked] = useState(false);
  const [roundCount, setRoundCount] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const findPartner = useCallback(async () => {
    if (!user) return;
    setStatus("matching");

    // Find a random online user
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("user_id", user.id)
      .eq("is_online", true)
      .limit(10);

    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      setPartner(random);
      setTimeLeft(ROUND_SECONDS);
      setLiked(false);
      setStatus("session");
      setRoundCount((c) => c + 1);

      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            setStatus("feedback");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      toast("No users available right now. Try again in a moment!", { duration: 3000 });
      setStatus("lobby");
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleLike = async () => {
    if (!user || !partner) return;
    setLiked(true);

    // Check if mutual
    await supabase.from("likes").insert({ liker_id: user.id, liked_id: partner.user_id });

    const { data: mutual } = await supabase
      .from("likes")
      .select("id")
      .eq("liker_id", partner.user_id)
      .eq("liked_id", user.id)
      .maybeSingle();

    if (mutual) {
      const [u1, u2] = [user.id, partner.user_id].sort();
      await supabase.from("matches").insert({ user1_id: u1, user2_id: u2 });
      toast.success(`🎉 It's a match with ${partner.display_name}!`);
    } else {
      toast.success(`💕 You liked ${partner.display_name}!`);
    }
  };

  const handleSkip = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("feedback");
  };

  const handleNext = () => {
    findPartner();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const progress = ((ROUND_SECONDS - timeLeft) / ROUND_SECONDS) * 100;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold font-display text-foreground">Speed Dating</h1>
        </div>
        {status === "session" && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Round {roundCount}</span>
          </div>
        )}
      </div>

      {status === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mb-6 flex h-24 w-24 items-center justify-center rounded-full gradient-love"
          >
            <Zap className="h-12 w-12 text-primary-foreground" />
          </motion.div>
          <h2 className="text-2xl font-bold font-display text-foreground mb-2">Speed Dating</h2>
          <p className="text-sm text-muted-foreground max-w-[280px] mb-8">
            Get matched with someone for a 3-minute conversation. If you both like each other, it's a match!
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <div className="flex items-center gap-3 rounded-2xl bg-card p-3 border border-border">
              <Timer className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">3-Minute Rounds</p>
                <p className="text-xs text-muted-foreground">Quick connections, real vibes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-card p-3 border border-border">
              <Heart className="h-5 w-5 text-primary shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Mutual Matching</p>
                <p className="text-xs text-muted-foreground">Both like = instant match</p>
              </div>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={findPartner}
            className="mt-8 w-full max-w-[280px] rounded-2xl gradient-love py-3.5 text-sm font-bold text-primary-foreground shadow-card"
          >
            ⚡ Start Speed Dating
          </motion.button>
        </div>
      )}

      {status === "matching" && (
        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary border-t-transparent"
          />
          <p className="text-sm font-medium text-foreground">Finding your next match...</p>
          <p className="text-xs text-muted-foreground mt-1">This won't take long</p>
        </div>
      )}

      {(status === "session" || status === "feedback") && partner && (
        <div className="flex flex-1 flex-col">
          {/* Timer bar */}
          {status === "session" && (
            <div className="px-4 pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Time remaining</span>
                <span className={`text-sm font-bold font-display ${timeLeft <= 30 ? "text-destructive" : "text-foreground"}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full gradient-love"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Partner display */}
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className="rounded-full p-1 gradient-love">
                <Avatar className="h-32 w-32 border-4 border-card">
                  <AvatarImage src={partner.avatar_url || ""} />
                  <AvatarFallback className="bg-muted text-3xl font-bold text-muted-foreground">
                    {partner.display_name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              {partner.is_online && (
                <span className="absolute bottom-2 right-2 h-5 w-5 rounded-full bg-green-500 border-3 border-card" />
              )}
            </motion.div>

            <h3 className="mt-4 text-xl font-bold font-display text-foreground">
              {partner.display_name}{partner.age ? `, ${partner.age}` : ""}
            </h3>
            {partner.location && (
              <p className="text-sm text-muted-foreground mt-1">{partner.location}</p>
            )}
            {partner.bio && (
              <p className="text-sm text-muted-foreground mt-2 text-center max-w-[240px]">{partner.bio}</p>
            )}

            {/* Interest tags */}
            {partner.interests && partner.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                {partner.interests.slice(0, 5).map((i) => (
                  <span key={i} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          {status === "session" && (
            <div className="px-6 pb-6">
              <div className="flex items-center justify-center gap-3 mb-4">
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={`rounded-full p-3 ${audioEnabled ? "bg-muted" : "bg-destructive/15"}`}
                >
                  {audioEnabled ? (
                    <Mic className="h-5 w-5 text-foreground" />
                  ) : (
                    <MicOff className="h-5 w-5 text-destructive" />
                  )}
                </button>
                <button
                  onClick={() => setVideoEnabled(!videoEnabled)}
                  className={`rounded-full p-3 ${videoEnabled ? "bg-muted" : "bg-destructive/15"}`}
                >
                  {videoEnabled ? (
                    <Video className="h-5 w-5 text-foreground" />
                  ) : (
                    <VideoOff className="h-5 w-5 text-destructive" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-center gap-4">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSkip}
                  className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/30 bg-card"
                >
                  <X className="h-6 w-6 text-destructive" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleLike}
                  disabled={liked}
                  className={`flex h-16 w-16 items-center justify-center rounded-full shadow-card ${
                    liked ? "bg-green-500" : "gradient-love"
                  }`}
                >
                  <Heart className={`h-7 w-7 text-primary-foreground ${liked ? "fill-primary-foreground" : ""}`} />
                </motion.button>
              </div>
            </div>
          )}

          {status === "feedback" && (
            <div className="px-6 pb-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {timeLeft === 0 ? "⏰ Time's up!" : "Round ended"}
              </p>
              {!liked && (
                <div className="flex items-center justify-center gap-4 mb-4">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleNext}
                    className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/30 bg-card"
                  >
                    <X className="h-6 w-6 text-destructive" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { handleLike(); }}
                    className="flex h-16 w-16 items-center justify-center rounded-full gradient-love shadow-card"
                  >
                    <Heart className="h-7 w-7 text-primary-foreground" />
                  </motion.button>
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                className="w-full rounded-2xl gradient-love py-3 text-sm font-bold text-primary-foreground shadow-card"
              >
                ⚡ Next Person
              </motion.button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpeedDating;
