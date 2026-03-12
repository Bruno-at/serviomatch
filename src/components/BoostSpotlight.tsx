import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Star, X, Coins, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BoostSpotlightProps {
  compact?: boolean;
}

const BoostSpotlight = ({ compact }: BoostSpotlightProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [isBoosted, setIsBoosted] = useState(false);
  const [isSpotlight, setIsSpotlight] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchStatus = async () => {
      const [{ data: coinData }, { data: profile }] = await Promise.all([
        supabase.from("user_coins").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("is_boosted, boost_expires_at, is_spotlight, spotlight_expires_at").eq("user_id", user.id).single(),
      ]);

      if (coinData) setBalance(coinData.balance);
      else {
        await supabase.from("user_coins").insert({ user_id: user.id, balance: 100 });
        setBalance(100);
      }

      if (profile) {
        const now = new Date();
        setIsBoosted(!!(profile as any).is_boosted && new Date((profile as any).boost_expires_at) > now);
        setIsSpotlight(!!(profile as any).is_spotlight && new Date((profile as any).spotlight_expires_at) > now);

        if ((profile as any).is_boosted && (profile as any).boost_expires_at) {
          const remaining = new Date((profile as any).boost_expires_at).getTime() - now.getTime();
          if (remaining > 0) {
            setBoostTimeLeft(`${Math.ceil(remaining / 60000)}m left`);
          }
        }
      }
    };
    fetchStatus();
  }, [user]);

  const activateBoost = async () => {
    if (!user) return;
    const cost = 30;
    if (balance < cost) { toast.error("Not enough coins!"); return; }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await Promise.all([
      supabase.from("profiles").update({ is_boosted: true, boost_expires_at: expiresAt }).eq("user_id", user.id),
      supabase.from("user_coins").update({ balance: balance - cost }).eq("user_id", user.id),
    ]);

    setBalance(balance - cost);
    setIsBoosted(true);
    setBoostTimeLeft("30m left");
    setOpen(false);
    toast.success("⚡ Profile boosted for 30 minutes!");
  };

  const activateSpotlight = async () => {
    if (!user) return;
    const cost = 50;
    if (balance < cost) { toast.error("Not enough coins!"); return; }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await Promise.all([
      supabase.from("profiles").update({ is_spotlight: true, spotlight_expires_at: expiresAt }).eq("user_id", user.id),
      supabase.from("user_coins").update({ balance: balance - cost }).eq("user_id", user.id),
    ]);

    setBalance(balance - cost);
    setIsSpotlight(true);
    setOpen(false);
    toast.success("🌟 You're now in the Spotlight for 1 hour!");
  };

  if (compact) {
    return (
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
            isBoosted ? "bg-accent/20 text-accent" : "gradient-love text-primary-foreground"
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          {isBoosted ? boostTimeLeft : "Boost"}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${
            isSpotlight ? "bg-yellow-500/20 text-yellow-600" : "bg-muted text-muted-foreground"
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          {isSpotlight ? "Active" : "Spotlight"}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ y: 300 }}
                animate={{ y: 0 }}
                exit={{ y: 300 }}
                transition={{ type: "spring", damping: 25 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-elevated"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold font-display text-foreground">Visibility Boosts</h3>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                      <Coins className="h-3.5 w-3.5" />
                      {balance}
                    </span>
                    <button onClick={() => setOpen(false)} className="rounded-full bg-muted p-1.5">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Boost option */}
                  <div className="rounded-2xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full gradient-love">
                        <Zap className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">⚡ Profile Boost</p>
                        <p className="text-xs text-muted-foreground">Appear more in swipe results for 30 min</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                        <Coins className="h-3 w-3" /> 30
                      </span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={activateBoost}
                      disabled={isBoosted}
                      className="w-full rounded-xl gradient-love py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {isBoosted ? `Active - ${boostTimeLeft}` : "Activate Boost"}
                    </motion.button>
                  </div>

                  {/* Spotlight option */}
                  <div className="rounded-2xl border border-border p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500">
                        <Star className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">🌟 Spotlight</p>
                        <p className="text-xs text-muted-foreground">Featured in Top Profiles for 1 hour</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                        <Coins className="h-3 w-3" /> 50
                      </span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={activateSpotlight}
                      disabled={isSpotlight}
                      className="w-full rounded-xl bg-yellow-500 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {isSpotlight ? "Active" : "Activate Spotlight"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
};

export default BoostSpotlight;
