import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import VideoGrid from "./VideoGrid";
import type { Tables } from "@/integrations/supabase/types";

interface CallViewProps {
  matchId: string;
  otherUserProfile: Tables<"profiles">;
  mode: "audio" | "video";
  onEnd: () => void;
}

type CallState = "creating" | "ringing" | "accepted" | "active" | "ended";

const RING_TIMEOUT_MS = 60_000;

const CallView = ({ matchId, otherUserProfile, mode, onEnd }: CallViewProps) => {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("creating");
  const [callId, setCallId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  // Step 1: create the call session (status = ringing) — does NOT auto-connect
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("call_sessions")
        .insert({
          caller_id: user.id,
          receiver_id: otherUserProfile.user_id,
          match_id: matchId,
          mode,
          status: "ringing",
        })
        .select()
        .single();

      if (cancelled) return;
      if (error || !data) {
        toast.error("Could not start call");
        onEnd();
        return;
      }

      setCallId(data.id);
      callIdRef.current = data.id;
      setCallState("ringing");

      // Auto-timeout if no answer
      timeoutRef.current = setTimeout(() => {
        if (!finishedRef.current) {
          handleTimeout();
        }
      }, RING_TIMEOUT_MS);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Step 2: subscribe to status changes on the call session
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call:${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions", filter: `id=eq.${callId}` },
        (payload) => {
          const next = payload.new as Tables<"call_sessions">;
          if (next.status === "accepted" && callState === "ringing") {
            setCallState("accepted");
            connectToRoom(next.id);
          } else if (next.status === "rejected") {
            finishedRef.current = true;
            toast("Call declined");
            cleanup();
            onEnd();
          } else if (next.status === "ended" && callState !== "ended") {
            finishedRef.current = true;
            toast("Call ended");
            cleanup();
            onEnd();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callState]);

  const connectToRoom = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { room_id: `call-${id}` },
      });
      if (error || !data?.token) throw error || new Error("No token");
      setToken(data.token);
      setUrl(data.url);
      setCallState("active");
      // Start duration timer
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (e: any) {
      toast.error("Could not connect: " + (e?.message || "unknown"));
      handleEndCall();
    }
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleTimeout = async () => {
    finishedRef.current = true;
    if (callIdRef.current) {
      await supabase
        .from("call_sessions")
        .update({ status: "missed", ended_at: new Date().toISOString() })
        .eq("id", callIdRef.current);
    }
    toast("No answer");
    cleanup();
    onEnd();
  };

  const handleEndCall = async () => {
    finishedRef.current = true;
    if (callIdRef.current) {
      await supabase
        .from("call_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callIdRef.current);
    }
    cleanup();
    setCallState("ended");
    onEnd();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      // If still ringing when component unmounts, mark ended
      if (callIdRef.current && !finishedRef.current) {
        supabase
          .from("call_sessions")
          .update({ status: "ended", ended_at: new Date().toISOString() })
          .eq("id", callIdRef.current);
      }
    };
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // ACTIVE call → render LiveKit grid
  if (callState === "active" && token && url) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-white/20">
              <AvatarImage src={otherUserProfile.avatar_url || ""} />
              <AvatarFallback className="bg-muted">{otherUserProfile.display_name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{otherUserProfile.display_name}</p>
              <p className="text-white/70 text-xs">{formatDuration(duration)}</p>
            </div>
          </div>
        </div>
        <VideoGrid token={token} url={url} onDisconnect={handleEndCall} />
      </div>
    );
  }

  // RINGING / CREATING → caller waiting screen
  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-between py-16 px-6">
      <div className="text-center">
        <p className="text-white/60 text-xs uppercase tracking-widest mb-1">
          {mode === "video" ? "Video call" : "Voice call"}
        </p>
        <p className="text-white/80 text-sm">
          {callState === "creating" && "Starting call…"}
          {callState === "ringing" && "Calling…"}
          {callState === "accepted" && "Connecting…"}
        </p>
      </div>

      <div className="flex flex-col items-center relative">
        {/* Ripple effect */}
        {callState === "ringing" && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border border-pink-500/30"
                style={{ width: 160, height: 160 }}
                animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, delay: i * 0.6 }}
              />
            ))}
          </div>
        )}
        <Avatar className="h-36 w-36 border-4 border-white/20 shadow-2xl relative z-10">
          <AvatarImage src={otherUserProfile.avatar_url || ""} />
          <AvatarFallback className="bg-muted text-5xl font-bold">
            {otherUserProfile.display_name[0]}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-white text-2xl font-bold mt-6">{otherUserProfile.display_name}</h2>
        {callState === "accepted" && (
          <div className="mt-3 flex items-center gap-2 text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Joining…</span>
          </div>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleEndCall}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40"
        aria-label="End call"
      >
        <PhoneOff className="h-7 w-7 text-white" />
      </motion.button>
    </div>
  );
};

export default CallView;
