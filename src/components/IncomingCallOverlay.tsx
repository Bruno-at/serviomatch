import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video as VideoIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import VideoGrid from "./VideoGrid";
import type { Tables } from "@/integrations/supabase/types";

type IncomingCall = {
  session: Tables<"call_sessions">;
  caller: Pick<Tables<"profiles">, "user_id" | "display_name" | "avatar_url">;
};

const IncomingCallOverlay = () => {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [active, setActive] = useState<{ session: Tables<"call_sessions">; token: string; url: string; name: string; avatar: string | null } | null>(null);

  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // === Ringtone (WebAudio - no asset needed) ===
  const startRingtone = useCallback(() => {
    stopRingtone();
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;

      const playBeep = () => {
        if (!audioCtxRef.current) return;
        const c = audioCtxRef.current;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.value = 480;
        g.gain.value = 0;
        o.connect(g).connect(c.destination);
        const now = c.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.18, now + 0.05);
        g.gain.linearRampToValueAtTime(0, now + 0.4);
        o.start(now);
        o.stop(now + 0.45);

        const o2 = c.createOscillator();
        const g2 = c.createGain();
        o2.type = "sine";
        o2.frequency.value = 620;
        g2.gain.value = 0;
        o2.connect(g2).connect(c.destination);
        g2.gain.setValueAtTime(0, now + 0.5);
        g2.gain.linearRampToValueAtTime(0.18, now + 0.55);
        g2.gain.linearRampToValueAtTime(0, now + 0.9);
        o2.start(now + 0.5);
        o2.stop(now + 0.95);
      };

      playBeep();
      ringIntervalRef.current = setInterval(playBeep, 1500);
    } catch {
      // Ignore audio errors
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  // === Subscribe to incoming calls ===
  useEffect(() => {
    if (!user) return;

    const handleNew = async (session: Tables<"call_sessions">) => {
      if (session.receiver_id !== user.id) return;
      if (session.status !== "ringing") return;
      // Don't show duplicate
      if (incoming || active) return;

      const { data: caller } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .eq("user_id", session.caller_id)
        .maybeSingle();

      setIncoming({
        session,
        caller: caller || { user_id: session.caller_id, display_name: "Unknown", avatar_url: null },
      });
      startRingtone();
    };

    const channel = supabase
      .channel(`incoming-calls:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "call_sessions", filter: `receiver_id=eq.${user.id}` },
        (payload) => handleNew(payload.new as Tables<"call_sessions">),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions" },
        (payload) => {
          const updated = payload.new as Tables<"call_sessions">;
          // If caller cancels while we're ringing, dismiss
          if (incoming && updated.id === incoming.session.id && updated.status !== "ringing") {
            setIncoming(null);
            stopRingtone();
          }
          if (active && updated.id === active.session.id && updated.status === "ended") {
            setActive(null);
            toast("Call ended");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, incoming, active]);

  const handleAccept = async () => {
    if (!incoming) return;
    stopRingtone();
    const session = incoming.session;
    const callerInfo = incoming.caller;
    setIncoming(null);

    const { error } = await supabase
      .from("call_sessions")
      .update({ status: "accepted" })
      .eq("id", session.id);
    if (error) {
      toast.error("Could not accept call");
      return;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke("livekit-token", {
        body: { room_id: `call-${session.id}` },
      });
      if (fnError || !data?.token) throw fnError || new Error("No token");
      setActive({
        session,
        token: data.token,
        url: data.url,
        name: callerInfo.display_name,
        avatar: callerInfo.avatar_url,
      });
    } catch (e: any) {
      toast.error("Could not connect: " + (e?.message || "unknown"));
      await supabase
        .from("call_sessions")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", session.id);
    }
  };

  const handleReject = async () => {
    if (!incoming) return;
    stopRingtone();
    await supabase
      .from("call_sessions")
      .update({ status: "rejected", ended_at: new Date().toISOString() })
      .eq("id", incoming.session.id);
    setIncoming(null);
  };

  const handleEndActive = async () => {
    if (!active) return;
    await supabase
      .from("call_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", active.session.id);
    setActive(null);
  };

  // ACTIVE call (receiver side, after accept)
  if (active) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-white/20">
              <AvatarImage src={active.avatar || ""} />
              <AvatarFallback className="bg-muted">{active.name[0]}</AvatarFallback>
            </Avatar>
            <p className="text-white text-sm font-semibold">{active.name}</p>
          </div>
        </div>
        <VideoGrid token={active.token} url={active.url} onDisconnect={handleEndActive} />
      </div>
    );
  }

  // RINGING (receiver side)
  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-between py-16 px-6"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 text-white/70 text-xs uppercase tracking-widest mb-1">
              {incoming.session.mode === "video" ? <VideoIcon className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
              Incoming {incoming.session.mode} call
            </div>
          </div>

          <div className="flex flex-col items-center relative">
            <div className="absolute inset-0 flex items-center justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-green-500/30"
                  style={{ width: 160, height: 160 }}
                  animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.5 }}
                />
              ))}
            </div>
            <Avatar className="h-36 w-36 border-4 border-white/20 shadow-2xl relative z-10">
              <AvatarImage src={incoming.caller.avatar_url || ""} />
              <AvatarFallback className="bg-muted text-5xl font-bold">
                {incoming.caller.display_name[0]}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-white text-2xl font-bold mt-6">{incoming.caller.display_name}</h2>
            <p className="text-white/60 text-sm mt-1">is calling you…</p>
          </div>

          <div className="flex items-center gap-16">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleReject}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 shadow-lg shadow-red-500/40">
                <PhoneOff className="h-7 w-7 text-white" />
              </div>
              <span className="text-white/80 text-xs">Decline</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={handleAccept}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
                {incoming.session.mode === "video" ? (
                  <VideoIcon className="h-7 w-7 text-white" />
                ) : (
                  <Phone className="h-7 w-7 text-white" />
                )}
              </div>
              <span className="text-white/80 text-xs">Accept</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallOverlay;
