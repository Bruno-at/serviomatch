import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VirtualGiftsProps {
  receiverId: string;
  matchId?: string;
  onGiftSent?: (emoji: string) => void;
}

interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  coin_cost: number;
}

const VirtualGifts = ({ receiverId, matchId, onGiftSent }: VirtualGiftsProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: giftData } = await supabase.from("gift_catalog").select("*").order("coin_cost");
      if (giftData) setGifts(giftData);

      if (user) {
        const { data: coinData } = await supabase
          .from("user_coins")
          .select("balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (coinData) {
          setBalance(coinData.balance);
        } else {
          await supabase.from("user_coins").insert({ user_id: user.id, balance: 100 });
          setBalance(100);
        }
      }
    };
    fetchData();
  }, [user]);

  const sendGift = async (gift: GiftItem) => {
    if (!user || sending) return;
    if (balance < gift.coin_cost) {
      toast.error("Not enough coins! 💰");
      return;
    }

    setSending(true);

    const { data: newBalance, error: coinErr } = await supabase.rpc("adjust_coin_balance", {
      _delta: -gift.coin_cost,
      _reason: "gift_send",
      _metadata: { gift_name: gift.name, receiver_id: receiverId },
    });
    if (coinErr) {
      toast.error("Not enough coins! 💰");
      setSending(false);
      return;
    }

    await supabase.from("gift_transactions").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      gift_name: gift.name,
      gift_emoji: gift.emoji,
      coin_cost: gift.coin_cost,
      match_id: matchId || null,
    });

    setBalance(newBalance ?? balance - gift.coin_cost);
    setSending(false);
    setOpen(false);
    onGiftSent?.(gift.emoji);
    toast.success(`${gift.emoji} ${gift.name} sent!`);
  };

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-full bg-accent/15 h-10 w-10"
      >
        <Gift className="h-4 w-4 text-accent" />
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
                <h3 className="text-lg font-bold font-display text-foreground">Send a Gift</h3>
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

              <div className="grid grid-cols-4 gap-3">
                {gifts.map((gift) => (
                  <motion.button
                    key={gift.id}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => sendGift(gift)}
                    disabled={balance < gift.coin_cost || sending}
                    className={`flex flex-col items-center gap-1 rounded-2xl p-3 transition-colors ${
                      balance >= gift.coin_cost
                        ? "bg-muted hover:bg-primary/10"
                        : "bg-muted/50 opacity-50"
                    }`}
                  >
                    <span className="text-3xl">{gift.emoji}</span>
                    <span className="text-[10px] font-medium text-foreground">{gift.name}</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Coins className="h-2.5 w-2.5" />
                      {gift.coin_cost}
                    </span>
                  </motion.button>
                ))}
              </div>

              <button
                onClick={() => toast.success("🏪 100 bonus coins added!", { duration: 2000 })}
                className="mt-4 w-full rounded-2xl gradient-love py-3 text-sm font-semibold text-primary-foreground"
              >
                Buy More Coins
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VirtualGifts;
