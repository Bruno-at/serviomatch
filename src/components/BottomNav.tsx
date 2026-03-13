import { Heart, MessageCircle, User, Flame, MapPin, Users, Zap, Trophy } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavProps {
  active: string;
  onNavigate: (tab: string) => void;
  onSpeedDating?: () => void;
  onChallenges?: () => void;
}

const tabs = [
  { id: "discover", icon: Flame, label: "Discover" },
  { id: "nearby", icon: MapPin, label: "Nearby" },
  { id: "speed", icon: Zap, label: "Speed" },
  { id: "matches", icon: Users, label: "Matches" },
  { id: "challenges", icon: Trophy, label: "Ranks" },
  { id: "messages", icon: MessageCircle, label: "Chat" },
  { id: "profile", icon: User, label: "Profile" },
];

const BottomNav = ({ active, onNavigate, onSpeedDating, onChallenges }: BottomNavProps) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const isSpecial = tab.id === "speed" || tab.id === "challenges";
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === "speed" && onSpeedDating) {
                  onSpeedDating();
                } else if (tab.id === "challenges" && onChallenges) {
                  onChallenges();
                } else if (!isSpecial) {
                  onNavigate(tab.id);
                }
              }}
              className="relative flex flex-col items-center gap-0.5 px-1.5 py-1"
            >
              {isActive && !isSpecial && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-2 h-0.5 w-8 rounded-full gradient-love"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon
                className={`h-4 w-4 transition-colors ${
                  isSpecial ? "text-accent" : isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[9px] font-medium transition-colors ${
                  isSpecial ? "text-accent" : isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
