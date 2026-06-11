import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PremiumTier = "free" | "pro";

interface PremiumState {
  isPremium: boolean;
  tier: PremiumTier;
  isDeveloper: boolean;
  loading: boolean;
}

export const usePremium = (): PremiumState => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<PremiumState>({
    isPremium: false,
    tier: "free",
    isDeveloper: false,
    loading: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ isPremium: false, tier: "free", isDeveloper: false, loading: false });
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("plan, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      const active =
        !!data &&
        data.plan !== "basic" &&
        (!data.expires_at || new Date(data.expires_at).getTime() > Date.now());

      setState({
        isPremium: active,
        tier: active ? "pro" : "free",
        isDeveloper: false,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
};
