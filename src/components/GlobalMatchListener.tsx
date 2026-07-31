import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MatchPopup from "@/components/MatchPopup";
import { wasMatchHandledLocally } from "@/lib/matchFlow";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  onOpenChat?: (matchId: string, profile: Tables<"profiles">) => void;
}

/**
 * Listens for new matches in realtime so BOTH users see the match instantly,
 * without refreshing. The user who triggered the match already sees their own
 * popup, so those match ids are suppressed here.
 */
const GlobalMatchListener = ({ onOpenChat }: Props) => {
  const { user } = useAuth();
  const [myProfile, setMyProfile] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [popup, setPopup] = useState<{ matchId: string; profile: Tables<"profiles"> } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setMyProfile(data ?? { display_name: "You", avatar_url: null }); });

    const channel = supabase
      .channel("global-match-listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, async (payload) => {
        const m = payload.new as Tables<"matches">;
        if (m.user1_id !== user.id && m.user2_id !== user.id) return;
        if (wasMatchHandledLocally(m.id)) return;

        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", otherId)
          .maybeSingle();
        if (cancelled || !profile) return;
        setPopup({ matchId: m.id, profile: profile as Tables<"profiles"> });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Tables<"notifications">;
          if (n.type === "match") return; // the popup already covers this
          toast(n.title, { description: n.message });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!popup) return null;

  return (
    <MatchPopup
      open={!!popup}
      myName={myProfile?.display_name || "You"}
      myPhoto={myProfile?.avatar_url}
      matchName={popup.profile.display_name}
      matchPhoto={popup.profile.avatar_url}
      onChat={() => {
        onOpenChat?.(popup.matchId, popup.profile);
        setPopup(null);
      }}
      onClose={() => setPopup(null)}
    />
  );
};

export default GlobalMatchListener;
