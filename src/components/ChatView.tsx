import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import VirtualGifts from "./VirtualGifts";
import GiftAnimation from "./GiftAnimation";
import IcebreakerQuestions from "./IcebreakerQuestions";
import type { Tables } from "@/integrations/supabase/types";

interface ChatViewProps {
  matchId: string;
  otherUserProfile: Tables<"profiles">;
  onBack: () => void;
}

const ChatView = ({ matchId, otherUserProfile, onBack }: ChatViewProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Tables<"messages">[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [giftEmoji, setGiftEmoji] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Tables<"messages">]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId]);

  // Typing indicator channel
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`typing:${matchId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.user_id !== user.id) {
          setOtherTyping(true);
          setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, user]);

  // Listen for gift animations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`gifts:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_transactions", filter: `match_id=eq.${matchId}` },
        (payload) => {
          const gift = payload.new as any;
          if (gift.sender_id !== user.id) {
            setGiftEmoji(gift.gift_emoji);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  const broadcastTyping = () => {
    if (!user) return;
    supabase.channel(`typing:${matchId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id },
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) {
      setIsTyping(true);
      broadcastTyping();
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setIsTyping(false), 2000);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: user.id,
      content: newMessage.trim(),
    });
    if (!error) setNewMessage("");
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex h-full flex-col">
      <GiftAnimation emoji={giftEmoji} onComplete={() => setGiftEmoji(null)} />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-full p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          {otherUserProfile.avatar_url ? (
            <div className="relative">
              <img src={otherUserProfile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
              {otherUserProfile.is_online && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
              )}
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-love text-sm font-bold text-primary-foreground">
              {otherUserProfile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-semibold text-sm text-foreground">{otherUserProfile.display_name}</span>
            <p className="text-[10px] text-muted-foreground">
              {otherTyping ? (
                <span className="text-primary font-medium">Typing...</span>
              ) : otherUserProfile.is_online ? (
                <span className="text-green-500">Online</span>
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>
        <VirtualGifts
          receiverId={otherUserProfile.user_id}
          matchId={matchId}
          onGiftSent={(emoji) => setGiftEmoji(emoji)}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-hide">
        {messages.length === 0 && (
          <>
            <p className="text-center text-sm text-muted-foreground mt-6 mb-3">
              Say hi to start the conversation! 👋
            </p>
            <IcebreakerQuestions
              onSelect={(q) => {
                setNewMessage(q);
              }}
            />
          </>
        )}
        {messages.map((msg, idx) => {
          const isMine = msg.sender_id === user?.id;
          const isLast = idx === messages.length - 1;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div className="flex flex-col">
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMine
                      ? "gradient-love text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
                  <span className="text-[9px] text-muted-foreground">{formatTime(msg.created_at)}</span>
                  {isMine && isLast && (
                    <CheckCheck className="h-3 w-3 text-primary" />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Typing indicator */}
        <AnimatePresence>
          {otherTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex justify-start"
            >
              <div className="bg-muted rounded-2xl px-4 py-2 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex gap-2">
        <input
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded-xl bg-muted py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleSend}
          disabled={!newMessage.trim() || sending}
          className="flex h-10 w-10 items-center justify-center rounded-full gradient-love shadow-card disabled:opacity-50"
        >
          <Send className="h-4 w-4 text-primary-foreground" />
        </motion.button>
      </div>
    </div>
  );
};

export default ChatView;
