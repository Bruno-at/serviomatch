import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Gift, Eye, Heart, Share2, UserPlus, MessageCircle, Video, WifiOff, RefreshCw } from "lucide-react";
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
  { emoji: "🌹", label: "Rose", cost: 1 },
  { emoji: "❤️", label: "Heart", cost: 5 },
  { emoji: "🔥", label: "Fire", cost: 10 },
  { emoji: "💎", label: "Diamond", cost: 50 },
  { emoji: "👑", label: "Crown", cost: 100 },
  { emoji: "🚀", label: "Rocket", cost: 200 },
  { emoji: "🦁", label: "Lion", cost: 500 },
  { emoji: "🏎️", label: "Supercar", cost: 1000 },
];

const LiveRoom = ({ room, hostName, hostAvatar, onLeave }: LiveRoomProps) => {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showGifts, setShowGifts] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [viewerCount, setViewerCount] = useState(room.viewer_count);
  const [videoToken, setVideoToken] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoActive, setVideoActive] = useState(false);
  const [joiningVideo, setJoiningVideo] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showChat, setShowChat] = useState(true);
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

  const handleVideoDropped = () => setWasDisconnected(true);

  const handleParticipantLeft = (participantName: string) => {
    setMessages((prev) => [
      ...prev,
      {
        message: {
          id: `sys-left-${Date.now()}`,
          room_id: room.id,
          sender_id: "",
          content: `${participantName} left the live`,
          message_type: "system",
          created_at: new Date().toISOString(),
        } as Tables<"live_messages">,
        senderName: "System",
      },
    ]);
  };

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
        .then(() => setViewerCount((v) => v + 1));
      supabase.from("live_messages").insert({
        room_id: room.id,
        sender_id: user!.id,
        content: "joined the live",
        message_type: "join",
      });
    }

    if (isHost) joinVideo();

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
          setMessages((prev) => [...prev.slice(-50), { message: msg, senderName: name }]);
          if (msg.message_type === "gift") {
            const id = reactionId.current++;
            const x = Math.random() * 40;
            setFloatingReactions((prev) => [...prev, { id, emoji: msg.content, x }]);
            setTimeout(() => {
              setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
            }, 3000);
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

  const handleLike = () => {
    setLiked(true);
    const id = reactionId.current++;
    const x = Math.random() * 40;
    setFloatingReactions((prev) => [...prev, { id, emoji: "❤️", x }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
    setTimeout(() => setLiked(false), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Only show the last 30 messages for performance
  const visibleMessages = messages.slice(-30);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Full-screen video background */}
      <div className="absolute inset-0">
        {videoActive && videoToken && videoUrl ? (
          <VideoGrid
            token={videoToken}
            url={videoUrl}
            onDisconnect={() => setVideoActive(false)}
            onDropped={handleVideoDropped}
            onParticipantLeft={handleParticipantLeft}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
            {hostAvatar ? (
              <img src={hostAvatar} alt="" className="h-full w-full object-cover opacity-40 blur-sm" />
            ) : null}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {hostAvatar ? (
                <img src={hostAvatar} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-pink-500/50 mb-4" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white mb-4">
                  {hostName.charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-white text-lg font-bold">{hostName}</p>
              <p className="text-white/60 text-sm mt-1">{room.title}</p>
              {!videoActive && !isHost && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={joinVideo}
                  disabled={joiningVideo}
                  className="mt-6 flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white"
                >
                  {wasDisconnected ? (
                    joiningVideo ? <RefreshCw className="h-4 w-4 animate-spin" /> : <WifiOff className="h-4 w-4" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                  {joiningVideo ? "Joining..." : wasDisconnected ? "Reconnect" : "Join Video"}
                </motion.button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === TikTok-style overlay UI === */}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2 safe-area-top">
        {/* Host info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md pl-1 pr-3 py-1">
            {hostAvatar ? (
              <img src={hostAvatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-pink-500" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white ring-2 ring-pink-500">
                {hostName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-white text-xs font-semibold leading-tight">{hostName}</span>
              <span className="text-white/50 text-[10px] leading-tight">Host</span>
            </div>
          </div>
          {/* Follow button */}
          {!isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="rounded-full bg-pink-500 px-3 py-1"
            >
              <UserPlus className="h-3.5 w-3.5 text-white" />
            </motion.button>
          )}
        </div>

        {/* Right: viewer count + close */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-md px-2.5 py-1.5">
            <Eye className="h-3.5 w-3.5 text-white/80" />
            <span className="text-xs font-semibold text-white">{viewerCount}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onLeave}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
          >
            <X className="h-4 w-4 text-white" />
          </motion.button>
        </div>
      </div>

      {/* Live badge */}
      <div className="relative z-10 px-4">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded bg-red-500 px-2 py-0.5">
            <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold text-white tracking-wide">LIVE</span>
          </div>
          {room.description && (
            <span className="text-white/60 text-[11px] truncate max-w-[200px]">{room.description}</span>
          )}
        </div>
      </div>

      {/* Spacer to push content down */}
      <div className="flex-1 relative z-10" />

      {/* Floating reactions (right side, TikTok style) */}
      <div className="absolute right-4 bottom-36 z-20 pointer-events-none w-12">
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 1, y: 0, scale: 0.5, x: r.x }}
              animate={{ opacity: 0, y: -200, scale: 1.8, x: r.x + (Math.random() - 0.5) * 30 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.5, ease: "easeOut" }}
              className="text-3xl absolute bottom-0"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Right side action buttons (TikTok style) */}
      <div className="absolute right-3 bottom-36 z-10 flex flex-col items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => setShowChat(!showChat)}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-[9px]">Chat</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => setShowGifts(!showGifts)}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Gift className="h-5 w-5 text-yellow-400" />
          </div>
          <span className="text-white text-[9px]">Gift</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={handleLike}
          className="flex flex-col items-center gap-0.5"
        >
          <motion.div
            animate={liked ? { scale: [1, 1.4, 1] } : {}}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
          >
            <Heart className={`h-5 w-5 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
          </motion.div>
          <span className="text-white text-[9px]">Like</span>
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.8 }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-[9px]">Share</span>
        </motion.button>
        {isHost && (
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={handleEndLive}
            className="flex flex-col items-center gap-0.5"
          >
            <div className="h-10 w-10 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center">
              <X className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[9px]">End</span>
          </motion.button>
        )}
      </div>

      {/* Chat overlay (bottom-left, TikTok style) */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 px-3 mb-2 max-h-[35%] overflow-hidden"
          >
            {/* Gradient fade at top */}
            <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black/30 to-transparent pointer-events-none z-10" />
            <div className="overflow-y-auto max-h-[35vh] scrollbar-hide pr-16">
              {visibleMessages.length === 0 ? (
                <p className="text-white/40 text-xs py-2">Welcome to the live! 👋</p>
              ) : (
                <div className="space-y-1.5">
                  {visibleMessages.map((item) => {
                    const { message: msg, senderName } = item;
                    if (msg.message_type === "join") {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-1"
                        >
                          <span className="text-[11px] rounded-full bg-white/10 backdrop-blur-sm px-2 py-0.5 text-white/60">
                            <span className="text-cyan-400 font-medium">{senderName}</span> {msg.content}
                          </span>
                        </motion.div>
                      );
                    }
                    if (msg.message_type === "gift") {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1.5"
                        >
                          <span className="rounded-full bg-gradient-to-r from-yellow-500/20 to-pink-500/20 backdrop-blur-sm px-2.5 py-1 text-[11px] text-white">
                            <span className="text-yellow-300 font-semibold">{senderName}</span> sent {" "}
                            <span className="text-lg leading-none">{msg.content}</span>
                          </span>
                        </motion.div>
                      );
                    }
                    if (msg.message_type === "system") {
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-1"
                        >
                          <span className="text-[11px] rounded-full bg-red-500/20 backdrop-blur-sm px-2 py-0.5 text-red-300">
                            ⚠ {msg.content}
                          </span>
                        </motion.div>
                      );
                    }
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-1"
                      >
                        <span className="text-[11px] rounded-2xl bg-white/10 backdrop-blur-sm px-2.5 py-1 text-white/90 max-w-[70vw]">
                          <span className="text-cyan-400 font-semibold">{senderName}</span>{" "}
                          {msg.content}
                        </span>
                      </motion.div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gift picker (TikTok style bottom sheet) */}
      <AnimatePresence>
        {showGifts && (
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl bg-gray-900/95 backdrop-blur-xl border-t border-white/10"
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-white text-sm font-semibold">Send a Gift</span>
              <button onClick={() => setShowGifts(false)}>
                <X className="h-5 w-5 text-white/50" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 px-4 pb-6 pt-1">
              {giftReactions.map((g) => (
                <motion.button
                  key={g.label}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => handleGift(g.emoji)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/5 border border-white/10 py-3 hover:bg-white/10 transition-colors"
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <span className="text-[10px] text-white/70 font-medium">{g.label}</span>
                  <span className="text-[9px] text-yellow-400 font-semibold">{g.cost} 🪙</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom input bar (TikTok style) */}
      <div className="relative z-10 flex items-center gap-2 px-3 pb-3 pt-1 safe-area-bottom">
        <div className="flex-1 flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Say something..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500 disabled:opacity-40"
        >
          <Send className="h-4 w-4 text-white" />
        </motion.button>
      </div>
    </div>
  );
};

export default LiveRoom;
