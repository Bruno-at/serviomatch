import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Gift, X, Eye, Video, WifiOff, RefreshCw, Minimize2, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import VideoGrid from "./VideoGrid";

interface LiveRoomProps {
  room: Tables<"live_rooms">;
  hostName: string;
  hostAvatar: string | null;
  onLeave: () => void;
}

interface MessageWithSender {
  message: Tables<"live_messages">;
  senderName: string;
}

const giftReactions = [
  { emoji: "❤️", label: "Heart" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "⭐", label: "Star" },
  { emoji: "🎉", label: "Party" },
  { emoji: "💎", label: "Diamond" },
  { emoji: "🌹", label: "Rose" },
];

const LiveRoom = ({ room, hostName, hostAvatar, onLeave }: LiveRoomProps) => {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [viewerCount, setViewerCount] = useState(room.viewer_count);
  const [videoToken, setVideoToken] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoActive, setVideoActive] = useState(false);
  const [joiningVideo, setJoiningVideo] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reactionId = useRef(0);
  const isHost = user?.id === room.host_id;
  const profileCache = useRef<Map<string, string>>(new Map());

  const getSenderName = async (senderId: string): Promise<string> => {
    if (profileCache.current.has(senderId)) return profileCache.current.get(senderId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", senderId)
      .single();
    const name = data?.display_name || "User";
    profileCache.current.set(senderId, name);
    return name;
  };

  const handleVideoDropped = () => {
    setWasDisconnected(true);
  };

  const handleParticipantLeft = (participantName: string) => {
    setMessages((prev) => [
      ...prev,
      {
        message: {
          id: `sys-left-${Date.now()}`,
          room_id: room.id,
          sender_id: "",
          content: `${participantName} left the call`,
          message_type: "system",
          created_at: new Date().toISOString(),
        } as Tables<"live_messages">,
        senderName: "System",
      },
    ]);
  };

  // Fetch LiveKit token
  const joinVideo = async () => {
    if (!session?.access_token) return;
    setWasDisconnected(false);
    setJoiningVideo(true);
    try {
      const { data, error } = await supabase.functions.invoke("livekit-token", {
        body: { room_id: room.id },
      });
      if (error) throw error;
      setVideoToken(data.token);
      setVideoUrl(data.url);
      setVideoActive(true);
    } catch (e: any) {
      toast.error("Failed to join video: " + (e.message || "Unknown error"));
      // If the user was explicitly trying to reconnect, keep the banner around.
      setWasDisconnected(true);
    } finally {
      setJoiningVideo(false);
    }
  };

  useEffect(() => {
    if (!isHost) {
      supabase
        .from("live_rooms")
        .update({ viewer_count: viewerCount + 1 })
        .eq("id", room.id)
        .then(() => {
          setViewerCount((v) => v + 1);
        });
      supabase.from("live_messages").insert({
        room_id: room.id,
        sender_id: user!.id,
        content: "joined the live",
        message_type: "join",
      });
    }

    // Auto-join video for host
    if (isHost) {
      joinVideo();
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("live_messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) {
        const withNames: MessageWithSender[] = [];
        for (const msg of data) {
          const name = await getSenderName(msg.sender_id);
          withNames.push({ message: msg, senderName: name });
        }
        setMessages(withNames);
      }
    };
    fetchMessages();

    const channel = supabase
      .channel(`live:${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_messages", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          const msg = payload.new as Tables<"live_messages">;
          const name = await getSenderName(msg.sender_id);
          setMessages((prev) => [...prev, { message: msg, senderName: name }]);
          if (msg.message_type === "gift") {
            const id = reactionId.current++;
            setFloatingReactions((prev) => [...prev, { id, emoji: msg.content }]);
            setTimeout(() => {
              setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
            }, 2000);
          }
        },
      )
      .subscribe();

    return () => {
      if (!isHost) {
        supabase.from("live_rooms").update({ viewer_count: Math.max(0, viewerCount - 1) }).eq("id", room.id);
      }
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    await supabase.from("live_messages").insert({
      room_id: room.id,
      sender_id: user.id,
      content: newMessage.trim(),
      message_type: "text",
    });
    setNewMessage("");
    setSending(false);
  };

  const handleGift = async (emoji: string) => {
    if (!user) return;
    setShowGifts(false);
    await supabase.from("live_messages").insert({
      room_id: room.id,
      sender_id: user.id,
      content: emoji,
      message_type: "gift",
    });
  };

  const handleEndLive = async () => {
    await supabase
      .from("live_rooms")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("id", room.id);
    toast("Live ended 🔴");
    onLeave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Minimized bar */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 left-0 right-0 mx-auto max-w-md z-50"
          >
            <div className="mx-4 rounded-t-2xl gradient-love shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <button onClick={onLeave} className="rounded-full bg-foreground/20 backdrop-blur-sm p-1.5">
                  <ArrowLeft className="h-4 w-4 text-primary-foreground" />
                </button>
                {hostAvatar ? (
                  <img src={hostAvatar} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-primary-foreground/30" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20 text-sm font-bold text-primary-foreground ring-2 ring-primary-foreground/30">
                    {hostName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-primary-foreground text-sm truncate">{hostName}</p>
                  <p className="text-primary-foreground/70 text-xs truncate">{room.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-foreground/20 backdrop-blur-sm px-2 py-1">
                    <Eye className="h-3 w-3 text-primary-foreground" />
                    <span className="text-xs font-semibold text-primary-foreground">{viewerCount}</span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsMinimized(false)}
                    className="rounded-full bg-foreground/20 backdrop-blur-sm p-1.5"
                  >
                    <Maximize2 className="h-4 w-4 text-primary-foreground" />
                  </motion.button>
                </div>
              </div>
              {/* Quick-reply input */}
              <div className="flex items-center gap-2 px-3 pb-3">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Quick reply..."
                  className="flex-1 rounded-full bg-foreground/20 backdrop-blur-sm py-1.5 px-3 text-xs text-primary-foreground placeholder:text-primary-foreground/50 outline-none focus:ring-2 focus:ring-primary-foreground/30"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20 backdrop-blur-sm disabled:opacity-50"
                >
                  <Send className="h-3 w-3 text-primary-foreground" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full live room */}
      <motion.div
        initial={false}
        animate={{ y: isMinimized ? "100%" : 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="flex h-full flex-col relative overflow-hidden"
      >
        {/* Video area */}
        {videoActive && videoToken && videoUrl ? (
          <div className="h-[45%] min-h-[200px] bg-foreground/5">
            <VideoGrid
              token={videoToken}
              url={videoUrl}
              onDisconnect={() => setVideoActive(false)}
              onDropped={handleVideoDropped}
              onParticipantLeft={handleParticipantLeft}
            />
          </div>
        ) : (
          /* Header with gradient background */
          <div className="relative gradient-love px-4 pt-4 pb-16">
            <div className="flex items-center justify-between">
              <button onClick={onLeave} className="rounded-full bg-foreground/20 backdrop-blur-sm p-1.5">
                <ArrowLeft className="h-5 w-5 text-primary-foreground" />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full bg-foreground/20 backdrop-blur-sm px-2.5 py-1">
                  <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                  <span className="text-xs font-semibold text-primary-foreground">{viewerCount}</span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                  <span className="text-[10px] font-bold text-primary-foreground">LIVE</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsMinimized(true)}
                  className="rounded-full bg-foreground/20 backdrop-blur-sm p-1.5"
                >
                  <Minimize2 className="h-4 w-4 text-primary-foreground" />
                </motion.button>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              {hostAvatar ? (
                <img
                  src={hostAvatar}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-primary-foreground/30"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/20 text-lg font-bold text-primary-foreground ring-2 ring-primary-foreground/30">
                  {hostName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-primary-foreground text-sm">{hostName}</p>
                <p className="text-primary-foreground/70 text-xs">{room.title}</p>
              </div>
              {!videoActive && (!isHost || wasDisconnected) && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={joinVideo}
                  disabled={joiningVideo}
                  className="flex items-center gap-1.5 rounded-full bg-primary-foreground/20 backdrop-blur-sm px-3 py-1.5"
                >
                  {wasDisconnected ? (
                    joiningVideo ? (
                      <RefreshCw className="h-4 w-4 text-primary-foreground animate-spin" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-primary-foreground" />
                    )
                  ) : (
                    <Video className="h-4 w-4 text-primary-foreground" />
                  )}
                  <span className="text-xs font-semibold text-primary-foreground">
                    {joiningVideo
                      ? wasDisconnected
                        ? "Rejoining..."
                        : "Joining..."
                      : wasDisconnected
                        ? "Reconnect"
                        : "Join Video"}
                  </span>
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div
          className={`flex-1 ${!videoActive ? "-mt-8 rounded-t-3xl" : ""} bg-background overflow-y-auto px-4 pt-4 pb-2 relative`}
        >
          {/* Floating reactions */}
          <div className="absolute right-4 bottom-20 pointer-events-none">
            <AnimatePresence>
              {floatingReactions.map((r) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -120, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2 }}
                  className="text-2xl absolute bottom-0 right-0"
                >
                  {r.emoji}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground mt-8">Welcome to the live! Say something 👋</p>
          ) : (
            <div className="space-y-1.5">
              {messages.map((item) => {
                const { message: msg, senderName } = item;
                if (msg.message_type === "join") {
                  return (
                    <p key={msg.id} className="text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">{senderName}</span> {msg.content}
                    </p>
                  );
                }
                if (msg.message_type === "gift") {
                  return (
                    <motion.p
                      key={msg.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-xs"
                    >
                      <span className="font-semibold text-primary">{senderName}</span>{" "}
                      <span className="text-muted-foreground">sent</span>{" "}
                      <span className="text-lg">{msg.content}</span>
                    </motion.p>
                  );
                }
                if (msg.message_type === "system") {
                  return (
                    <motion.p
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      {msg.content}
                    </motion.p>
                  );
                }
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-sm"
                  >
                    <span className="font-semibold text-primary text-xs">{senderName}</span>{" "}
                    <span className="text-foreground text-xs">{msg.content}</span>
                  </motion.div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Gift picker */}
        <AnimatePresence>
          {showGifts && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-card border-t border-border px-4 py-3"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-foreground">Send a reaction</span>
                <button onClick={() => setShowGifts(false)}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex justify-around">
                {giftReactions.map((g) => (
                  <motion.button
                    key={g.label}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => handleGift(g.emoji)}
                    className="flex flex-col items-center gap-1 rounded-xl p-2 hover:bg-muted"
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="text-[10px] text-muted-foreground">{g.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="border-t border-border p-3 flex gap-2 items-center">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowGifts(!showGifts)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"
          >
            <Gift className="h-4 w-4 text-primary" />
          </motion.button>
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            className="flex-1 rounded-xl bg-muted py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-love shadow-card disabled:opacity-50"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </motion.button>
          {isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleEndLive}
              className="flex h-10 shrink-0 items-center justify-center rounded-full bg-destructive px-3"
            >
              <span className="text-xs font-semibold text-primary-foreground">End</span>
            </motion.button>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default LiveRoom;
