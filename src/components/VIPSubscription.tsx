import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Sparkles, Zap, Eye, Heart, MessageCircle, Radio, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VIPSubscriptionProps {
  onBack: () => void;
}

const plans = [
  {
    id: "basic",
    name: "Basic",
    emoji: "🥉",
    price: "Free",
    color: "bg-muted",
    features: [
      "10 daily swipes",
      "5 likes per day",
      "Basic matching",
      "Chat with matches",
    ],
  },
  {
    id: "gold",
    name: "Gold",
    emoji: "🥈",
    price: "$9.99/mo",
    color: "bg-yellow-500/10 border border-yellow-500/30",
    popular: true,
    features: [
      "Unlimited swipes",
      "See who liked you",
      "5 Super Likes/day",
      "1 Boost/week",
      "Read receipts",
      "Rewind last swipe",
    ],
  },
  {
    id: "platinum",
    name: "Platinum",
    emoji: "🥇",
    price: "$19.99/mo",
    color: "bg-primary/10 border border-primary/30",
    features: [
      "Everything in Gold",
      "Unlimited Super Likes",
      "Unlimited Boosts",
      "Priority in searches",
      "VIP live rooms",
      "Unlimited calls",
      "See profile visitors",
      "Incognito mode",
    ],
  },
];

const VIPSubscription = ({ onBack }: VIPSubscriptionProps) => {
  const { user } = useAuth();
  const [currentPlan, setCurrentPlan] = useState("basic");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setCurrentPlan(data.plan);
      });
  }, [user]);

  const handleSubscribe = async (planId: string) => {
    if (!user || planId === "basic") return;
    setLoading(true);

    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);

    await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: planId,
        started_at: new Date().toISOString(),
        expires_at: expires.toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Give bonus coins
    const bonus = planId === "gold" ? 200 : 500;
    await supabase.rpc("adjust_coin_balance", {
      _delta: bonus,
      _reason: "vip_bonus",
      _metadata: { plan: planId },
    });

    setCurrentPlan(planId);
    setLoading(false);
    toast.success(`🎉 Welcome to ${planId === "gold" ? "Gold" : "Platinum"}! +${bonus} bonus coins`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button onClick={onBack} className="rounded-full bg-muted p-2">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <h1 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" /> VIP Plans
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-4"
        >
          <Sparkles className="h-10 w-10 text-primary mx-auto mb-2" />
          <h2 className="text-lg font-bold text-foreground">Unlock Premium Features</h2>
          <p className="text-xs text-muted-foreground mt-1">Get more matches and stand out!</p>
        </motion.div>

        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl p-4 relative ${plan.color}`}
          >
            {plan.popular && (
              <span className="absolute -top-2 right-4 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold text-accent-foreground">
                POPULAR
              </span>
            )}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{plan.emoji}</span>
                <div>
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm font-semibold text-primary">{plan.price}</p>
                </div>
              </div>
              {currentPlan === plan.id && (
                <span className="rounded-full bg-primary/20 px-3 py-1 text-[10px] font-bold text-primary">
                  CURRENT
                </span>
              )}
            </div>

            <div className="space-y-2 mb-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            {plan.id !== "basic" && currentPlan !== plan.id && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading}
                className="w-full rounded-xl gradient-love py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {loading ? "Processing..." : `Upgrade to ${plan.name}`}
              </motion.button>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default VIPSubscription;
