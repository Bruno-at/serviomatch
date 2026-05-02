import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Gift, Eye, Heart, Share2, UserPlus, MessageCircle,
  Video, VideoOff, Mic, MicOff, WifiOff, RefreshCw, Loader2, SwitchCamera,
  Check, XCircle, Hand, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import VideoGrid from "./VideoGrid";
import LiveShareModal from "./LiveShareModal";

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

interface JoinRequest {
  id: string;
  user_id: string;
  status: string;
  displayName: string;
  avatarUrl: string | null;
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
  const [showChat, setShowChat] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // Join request states
  const [joinRequestStatus, setJoinRequestStatus] = useState<"none" | "pending" | "accepted" | "rejected">("none");
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const reactionId = useRef(0);
  const isHost = user?.id === room.host_id;
  const profileCache = useRef<Map<string, { name: string; avatar: string | null }>>(new Map());

  const getProfile = async (userId: string): Promise<{ name: string; avatar: string | null }> => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    const profile = { name: data?.display_name || "User", avatar: data?.avatar_url || null };
    profileCache.current.set(userId, profile);
    return profile;
  };

  const getSenderName = async (senderId: string): Promise<string> => {
    const p = await getProfile(senderId);
    return p.name;
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

  // Send a join request (viewer only)
  const sendJoinRequest = async () => {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    if (isHost) return;

    const prevStatus = joinRequestStatus;
    setJoinRequestStatus("pending");

    // Clean up any previous rejected/old requests by this user for this room
    await supabase
      .from("live_join_requests")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", user.id);

    const { data, error } = await supabase
      .from("live_join_requests")
      .insert({
        room_id: room.id,
        user_id: user.id,
        status: "pending",
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error("Join request failed:", error);
      toast.error(error?.message || "Failed to send request");
      setJoinRequestStatus(prevStatus);
      return;
    }

    toast.success("Request sent! Waiting for host… ✋");

    // Notify the host
    await supabase.from("notifications").insert({
      user_id: room.host_id,
      type: "general",
      title: "New join request",
      message: "Someone wants to join your live",
    });
  };

  // Host accepts/rejects a request
  const handleRequest = async (requestId: string, action: "accepted" | "rejected") => {
    const req = joinRequests.find((r) => r.id === requestId);
    const { error } = await supabase
      .from("live_join_requests")
      .update({ status: action })
      .eq("id", requestId);

    if (error) {
      toast.error("Failed to update request");
      return;
    }

    setJoinRequests((prev) => prev.filter((r) => r.id !== requestId));
    toast(action === "accepted" ? `${req?.displayName || "User"} accepted ✅` : "Request rejected");

    // Notify requester
    if (req) {
      await supabase.from("notifications").insert({
        user_id: req.user_id,
        type: "general",
        title: action === "accepted" ? "You're in! 🎉" : "Request declined",
        message: action === "accepted"
          ? `${hostName} accepted your request to join the live`
          : `${hostName} declined your request`,
      });
    }
  };

  // Fetch pending requests (host)
  const fetchJoinRequests = async () => {
    if (!isHost) return;
    const { data } = await supabase
      .from("live_join_requests")
      .select("*")
      .eq("room_id", room.id)
      .eq("status", "pending");

    if (data && data.length > 0) {
      const enriched: JoinRequest[] = [];
      for (const req of data) {
        const p = await getProfile(req.user_id);
        enriched.push({
          id: req.id,
          user_id: req.user_id,
          status: req.status,
          displayName: p.name,
          avatarUrl: p.avatar,
        });
      }
      setJoinRequests(enriched);
    } else {
      setJoinRequests([]);
    }
  };

  // Check viewer's own request status
  const checkOwnRequest = async () => {
    if (isHost || !user) return;
    const { data } = await supabase
      .from("live_join_requests")
      .select("*")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const status = data[0].status as "pending" | "accepted" | "rejected";
      setJoinRequestStatus(status);
      if (status === "accepted") {
        joinVideo();
      }
    }
  };

  useEffect(() => {
    // Viewer increment & join message
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

    // Host auto-joins video, viewers must request
    if (isHost) {
      joinVideo();
    } else {
      checkOwnRequest();
    }

    // Fetch messages
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

    // Fetch join requests if host
    if (isHost) fetchJoinRequests();

    // Realtime: messages
    const msgChannel = supabase
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

    // Realtime: join requests
    const reqChannel = supabase
      .channel(`join_requests:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_join_requests", filter: `room_id=eq.${room.id}` },
        async (payload) => {
          if (isHost) {
            // Host: refresh pending requests
            await fetchJoinRequests();
            if (payload.eventType === "INSERT") {
              const row = payload.new as any;
              const p = await getProfile(row.user_id);
              toast(`✋ ${p.name} wants to join`, {
                action: { label: "View", onClick: () => setShowRequests(true) },
              });
              setShowRequests(true);
            }
          } else if (user) {
            // Viewer: check if own request was updated
            const row = payload.new as any;
            if (row?.user_id === user.id) {
              const status = row.status as "pending" | "accepted" | "rejected";
              setJoinRequestStatus(status);
              if (status === "accepted") {
                toast.success("You've been accepted! Joining video… 🎉");
                joinVideo();
              } else if (status === "rejected") {
                toast.error("Your request was declined");
              }
            }
          }
        },
      )
      .subscribe();

    return () => {
      if (!isHost) {
        supabase.from("live_rooms").update({ viewer_count: Math.max(0, viewerCount - 1) }).eq("id", room.id);
      }
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(reqChannel);
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

  const visibleMessages = messages.slice(-30);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Full-screen video background */}
      <div className="absolute inset-0">
        {videoActive && videoToken && videoUrl ? (
          <div className="h-full w-full">
            <VideoGrid
              token={videoToken}
              url={videoUrl}
              hideControls
              onDisconnect={() => {
                setVideoActive(false);
                setMediaReady(false);
              }}
              onDropped={handleVideoDropped}
              onParticipantLeft={handleParticipantLeft}
              onMediaReady={() => setMediaReady(true)}
            />
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
            {hostAvatar && (
              <img src={hostAvatar} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-md" />
            )}
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

              {/* Host: auto-joining */}
              {isHost && joiningVideo && (
                <div className="mt-6 flex items-center gap-2 text-white/70">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm font-medium">Starting live…</span>
                </div>
              )}

              {/* Viewer: Join request flow */}
              {!isHost && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  {joinRequestStatus === "none" && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={sendJoinRequest}
                      className="flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg"
                    >
                      <Hand className="h-4 w-4" />
                      Request to Join
                    </motion.button>
                  )}
                  {joinRequestStatus === "pending" && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 rounded-full bg-yellow-500/20 border border-yellow-500/40 px-5 py-2.5">
                        <Clock className="h-4 w-4 text-yellow-400 animate-pulse" />
                        <span className="text-sm font-medium text-yellow-300">Waiting for host…</span>
                      </div>
                      <p className="text-white/40 text-xs">The host will accept or decline your request</p>
                    </div>
                  )}
                  {joinRequestStatus === "rejected" && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 rounded-full bg-red-500/20 border border-red-500/40 px-5 py-2.5">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-medium text-red-300">Request declined</span>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setJoinRequestStatus("none"); }}
                        className="text-white/50 text-xs underline mt-1"
                      >
                        Try again
                      </motion.button>
                    </div>
                  )}
                  {joinRequestStatus === "accepted" && joiningVideo && (
                    <div className="flex items-center gap-2 text-white/70">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Joining live…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reconnect (both host & viewer) */}
              {wasDisconnected && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={joinVideo}
                  className="mt-4 flex items-center gap-2 rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </motion.button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connection status overlay */}
      <AnimatePresence>
        {joiningVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
              <span className="text-white text-sm font-semibold">Joining live…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === TikTok-style overlay UI === */}

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-3 pb-2">
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
          {!isHost && (
            <motion.button whileTap={{ scale: 0.9 }} className="rounded-full bg-pink-500 px-3 py-1">
              <UserPlus className="h-3.5 w-3.5 text-white" />
            </motion.button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Host: join requests badge */}
          {isHost && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setShowRequests(!showRequests); fetchJoinRequests(); }}
              className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
            >
              <Hand className="h-4 w-4 text-white" />
              {joinRequests.length > 0 && (
                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-pink-500 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white">{joinRequests.length}</span>
                </div>
              )}
            </motion.button>
          )}
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

      {/* Host: Join requests panel */}
      <AnimatePresence>
        {showRequests && isHost && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-20 mx-4 mt-2 rounded-2xl bg-gray-900/95 backdrop-blur-xl border border-white/10 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
              <span className="text-white text-sm font-semibold">Join Requests</span>
              <button onClick={() => setShowRequests(false)}>
                <X className="h-4 w-4 text-white/50" />
              </button>
            </div>
            {joinRequests.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-white/40 text-xs">No pending requests</p>
              </div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
                {joinRequests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
                    {req.avatarUrl ? (
                      <img src={req.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        {req.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{req.displayName}</p>
                      <p className="text-white/40 text-[10px]">Wants to join</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleRequest(req.id, "accepted")}
                        className="h-8 w-8 rounded-full bg-green-500/80 flex items-center justify-center"
                      >
                        <Check className="h-4 w-4 text-white" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => handleRequest(req.id, "rejected")}
                        className="h-8 w-8 rounded-full bg-red-500/80 flex items-center justify-center"
                      >
                        <X className="h-4 w-4 text-white" />
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="flex-1 relative z-10" />

      {/* Floating reactions */}
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

      {/* Right side action buttons */}
      <div className="absolute right-3 bottom-36 z-10 flex flex-col items-center gap-4">
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => setShowChat(!showChat)} className="flex flex-col items-center gap-0.5">
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-[9px]">Chat</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => setShowGifts(!showGifts)} className="flex flex-col items-center gap-0.5">
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Gift className="h-5 w-5 text-yellow-400" />
          </div>
          <span className="text-white text-[9px]">Gift</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.8 }} onClick={handleLike} className="flex flex-col items-center gap-0.5">
          <motion.div
            animate={liked ? { scale: [1, 1.4, 1] } : {}}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
          >
            <Heart className={`h-5 w-5 ${liked ? "text-red-500 fill-red-500" : "text-white"}`} />
          </motion.div>
          <span className="text-white text-[9px]">Like</span>
        </motion.button>
        <motion.button whileTap={{ scale: 0.8 }} onClick={() => setShowShare(true)} className="flex flex-col items-center gap-0.5">
          <div className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
            <Share2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-[9px]">Share</span>
        </motion.button>

        {/* Mute/Camera controls */}
        {videoActive && (
          <>
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => setCameraOn(!cameraOn)}
              className="flex flex-col items-center gap-0.5"
            >
              <div className={`h-10 w-10 rounded-full backdrop-blur-md flex items-center justify-center ${cameraOn ? "bg-black/40" : "bg-red-500/70"}`}>
                {cameraOn ? <Video className="h-5 w-5 text-white" /> : <VideoOff className="h-5 w-5 text-white" />}
              </div>
              <span className="text-white text-[9px]">{cameraOn ? "Cam" : "Off"}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              onClick={() => setMicOn(!micOn)}
              className="flex flex-col items-center gap-0.5"
            >
              <div className={`h-10 w-10 rounded-full backdrop-blur-md flex items-center justify-center ${micOn ? "bg-black/40" : "bg-red-500/70"}`}>
                {micOn ? <Mic className="h-5 w-5 text-white" /> : <MicOff className="h-5 w-5 text-white" />}
              </div>
              <span className="text-white text-[9px]">{micOn ? "Mic" : "Muted"}</span>
            </motion.button>
          </>
        )}

        {isHost && (
          <motion.button whileTap={{ scale: 0.8 }} onClick={handleEndLive} className="flex flex-col items-center gap-0.5">
            <div className="h-10 w-10 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center">
              <X className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-[9px]">End</span>
          </motion.button>
        )}
      </div>

      {/* Chat overlay */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 px-3 mb-2 max-h-[35%] overflow-hidden"
          >
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
                        <motion.div key={msg.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1">
                          <span className="text-[11px] rounded-full bg-white/10 backdrop-blur-sm px-2 py-0.5 text-white/60">
                            <span className="text-cyan-400 font-medium">{senderName}</span> {msg.content}
                          </span>
                        </motion.div>
                      );
                    }
                    if (msg.message_type === "gift") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5">
                          <span className="rounded-full bg-gradient-to-r from-yellow-500/20 to-pink-500/20 backdrop-blur-sm px-2.5 py-1 text-[11px] text-white">
                            <span className="text-yellow-300 font-semibold">{senderName}</span> sent{" "}
                            <span className="text-lg leading-none">{msg.content}</span>
                          </span>
                        </motion.div>
                      );
                    }
                    if (msg.message_type === "system") {
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1">
                          <span className="text-[11px] rounded-full bg-red-500/20 backdrop-blur-sm px-2 py-0.5 text-red-300">
                            ⚠ {msg.content}
                          </span>
                        </motion.div>
                      );
                    }
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-1">
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

      {/* Gift picker */}
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

      {/* Bottom input bar */}
      <div className="relative z-10 flex items-center gap-2 px-3 pb-3 pt-1">
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

      {/* Share modal */}
      <LiveShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        roomId={room.id}
        roomTitle={room.title}
        hostName={hostName}
      />
    </div>
  );
};

export default LiveRoom;
