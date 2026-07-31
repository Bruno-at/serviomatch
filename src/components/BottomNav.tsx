import { Heart, MessageCircle, User, Flame, MapPin, Users, Zap, Trophy, Radio, Lock, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface BottomNavProps {
  active: string;
  onNavigate: (tab: string) => void;
  onSpeedDating?: () => void;
  onChallenges?: () => void;
  onLive?: () => void;
  onCrush?: () => void;
  onLikes?: () => void;
  likesBadge?: number;
}

const coreTabs = [
  { id: "discover", icon: Flame, label: "Discover" },
  { id: "matches", icon: Users, label: "Matches" },
  { id: "messages", icon: MessageCircle, label: "Chat" },
  { id: "likes", icon: Heart, label: "Likes" },
  { id: "profile", icon: User, label: "Profile" },
];

const moreTabs = [
  { id: "nearby", icon: MapPin, label: "Nearby", color: "text-sky-500" },
  { id: "live", icon: Radio, label: "Go Live", color: "text-red-500" },
  { id: "speed", icon: Zap, label: "Speed Dating", color: "text-yellow-500" },
  { id: "crush", icon: Lock, label: "Secret Crush", color: "text-pink-500" },
  { id: "challenges", icon: Trophy, label: "Ranks & Challenges", color: "text-amber-500" },
];

const BottomNav = ({ active, onNavigate, onSpeedDating, onChallenges, onLive, onCrush, onLikes, likesBadge = 0 }: BottomNavProps) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleMoreAction = (id: string) => {
    setMoreOpen(false);
    if (id === "speed" && onSpeedDating) onSpeedDating();
    else if (id === "challenges" && onChallenges) onChallenges();
    else if (id === "live" && onLive) onLive();
    else if (id === "crush" && onCrush) onCrush();
    else if (id === "nearby") onNavigate("nearby");
  };

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-16 left-0 right-0 z-[70] mx-auto max-w-md px-4 pb-2"
            >
              <div className="rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
                {moreTabs.map((tab, i) => (
                  <button
                    key={tab.id}
                    onClick={() => handleMoreAction(tab.id)}
                    className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 ${
                      i < moreTabs.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-muted ${tab.color}`}>
                      <tab.icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-foreground">{tab.label}</span>
                    {tab.id === "likes" && likesBadge > 0 && (
                      <span className="rounded-full gradient-love px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {likesBadge > 99 ? "99+" : likesBadge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md flex items-center justify-around py-1.5 px-2">
          {coreTabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setMoreOpen(false); onNavigate(tab.id); }}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-1.5 h-0.5 w-8 rounded-full gradient-love"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon
                  className={`h-5 w-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1"
          >
            {likesBadge > 0 && !moreOpen && (
              <span className="absolute right-1 top-0 z-10 min-w-[16px] h-[16px] flex items-center justify-center rounded-full gradient-love px-1 text-[9px] font-bold text-primary-foreground">
                {likesBadge > 9 ? "9+" : likesBadge}
              </span>
            )}
            {moreOpen ? (
              <X className="h-5 w-5 text-primary transition-colors" />
            ) : (
              <Menu className="h-5 w-5 text-muted-foreground transition-colors" />
            )}
            <span className={`text-[10px] font-medium transition-colors ${moreOpen ? "text-primary" : "text-muted-foreground"}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
