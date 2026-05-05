import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Copy, Share2, Search, Users, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface LiveShareModalProps {
  open: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle: string;
  hostName: string;
}

type Candidate = Pick<Tables<"profiles">, "user_id" | "display_name" | "avatar_url" | "is_online"> & {
  isMatch: boolean;
};

const LiveShareModal = ({ open, onClose, roomId, roomTitle, hostName }: LiveShareModalProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"matches" | "online">("matches");
  const [matches, setMatches] = useState<Candidate[]>([]);
  const [online, setOnline] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const link = `${window.location.origin}?live=${roomId}`;

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);

    (async () => {
      // Matches
      const { data: matchRows } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      const matchUserIds = (matchRows || []).map((m) =>
        m.user1_id === user.id ? m.user2_id : m.user1_id,
      );

      const [{ data: matchProfiles }, { data: onlineProfiles }] = await Promise.all([
        matchUserIds.length
          ? supabase
              .from("profiles")
              .select("user_id, display_name, avatar_url, is_online")
              .in("user_id", matchUserIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, is_online")
          .eq("is_online", true)
          .neq("user_id", user.id)
          .limit(50),
      ]);

      const matchSet = new Set(matchUserIds);

      setMatches(
        (matchProfiles || []).map((p) => ({ ...p, isMatch: true })),
      );
      setOnline(
        (onlineProfiles || []).map((p) => ({ ...p, isMatch: matchSet.has(p.user_id) })),
      );
      setLoading(false);
    })();
  }, [open, user]);

  const sendInvite = async (target: Candidate) => {
    if (!user || invited.has(target.user_id)) return;
    setInvited((prev) => new Set(prev).add(target.user_id));

    const { error } = await supabase.rpc("send_notification", {
      _target_user_id: target.user_id,
      _type: "live_invite",
      _title: "You've been invited to a live 🎙️",
      _message: `${hostName} invited you to join "${roomTitle}"`,
    });

    if (error) {
      toast.error("Could not send invite");
      setInvited((prev) => {
        const n = new Set(prev);
        n.delete(target.user_id);
        return n;
      });
    } else {
      toast.success(`Invited ${target.display_name}`);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const shareExternal = async () => {
    const text = `Join ${hostName} live on Spark! 💕`;
    // Some embedded/iframe contexts (e.g. preview sandboxes) block navigator.share
    // with "Permission denied". Always fall back to copying the link instead of
    // throwing an unhandled error.
    if (navigator.share) {
      try {
        await navigator.share({ title: roomTitle, text, url: link });
        return;
      } catch (err: any) {
        // user cancelled OR permission denied → fall through to copy
        if (err?.name === "AbortError") return;
      }
    }
    copyLink();
  };

  const list = (tab === "matches" ? matches : online).filter((p) =>
    p.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[56] rounded-t-3xl bg-gray-900 border-t border-white/10 max-h-[85vh] flex flex-col"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 shrink-0">
              <h3 className="text-white text-base font-semibold">Invite to live</h3>
              <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10">
                <X className="h-5 w-5 text-white/60" />
              </button>
            </div>

            {/* Quick share row */}
            <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2.5 text-white text-sm font-medium"
              >
                <Copy className="h-4 w-4" /> Copy link
              </button>
              <button
                onClick={shareExternal}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-600 px-3 py-2.5 text-white text-sm font-medium"
              >
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 pb-2 shrink-0">
              <button
                onClick={() => setTab("matches")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === "matches" ? "bg-pink-500 text-white" : "bg-white/10 text-white/70"
                }`}
              >
                <Heart className="h-3 w-3" /> Matches
              </button>
              <button
                onClick={() => setTab("online")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === "online" ? "bg-pink-500 text-white" : "bg-white/10 text-white/70"
                }`}
              >
                <Users className="h-3 w-3" /> Online
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-xl bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-pink-500/40"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-6 scrollbar-hide">
              {loading ? (
                <p className="text-center text-white/50 text-sm py-10">Loading…</p>
              ) : list.length === 0 ? (
                <p className="text-center text-white/50 text-sm py-10">
                  {tab === "matches" ? "No matches yet" : "No one online right now"}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {list.map((p) => {
                    const sent = invited.has(p.user_id);
                    return (
                      <div
                        key={p.user_id}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5"
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={p.avatar_url || ""} />
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {p.display_name[0]}
                            </AvatarFallback>
                          </Avatar>
                          {p.is_online && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-gray-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{p.display_name}</p>
                          <p className="text-white/40 text-[11px]">
                            {p.isMatch ? "Match" : p.is_online ? "Online" : "Offline"}
                          </p>
                        </div>
                        <button
                          onClick={() => sendInvite(p)}
                          disabled={sent}
                          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            sent
                              ? "bg-white/10 text-white/40"
                              : "bg-pink-500 text-white hover:bg-pink-600"
                          }`}
                        >
                          <Send className="h-3 w-3" />
                          {sent ? "Invited" : "Invite"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LiveShareModal;
