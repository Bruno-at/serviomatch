import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, RefreshCw } from "lucide-react";

interface SmartConversationStartersProps {
  sharedInterests: string[];
  matchName: string;
  onSelect: (message: string) => void;
}

const GENERIC_STARTERS = [
  "What's the best trip you've ever taken? ✈️",
  "What are you binge-watching right now? 📺",
  "If you could have dinner with anyone, who? 🍽️",
  "What's your go-to weekend activity? 🎉",
  "What's on your bucket list? 🌍",
  "If you won the lottery, what's the first thing you'd do? 💰",
];

function generateStarters(sharedInterests: string[], name: string): string[] {
  const starters: string[] = [];

  for (const interest of sharedInterests.slice(0, 2)) {
    const lower = interest.toLowerCase();
    if (["travel", "hiking", "adventure"].some((w) => lower.includes(w))) {
      starters.push(`You both love ${interest.toLowerCase()}! What's your dream destination? 🌍`);
    } else if (["music", "afrobeats", "pop"].some((w) => lower.includes(w))) {
      starters.push(`You both enjoy ${interest.toLowerCase()}! Who's your favorite artist? 🎵`);
    } else if (["cooking", "food", "coffee"].some((w) => lower.includes(w))) {
      starters.push(`You both love ${interest.toLowerCase()}! What's your signature dish? 🍳`);
    } else if (["fitness", "yoga", "gym"].some((w) => lower.includes(w))) {
      starters.push(`You both enjoy ${interest.toLowerCase()}! What's your workout routine? 💪`);
    } else {
      starters.push(`I see you're into ${interest.toLowerCase()} too! What got you into it? ✨`);
    }
  }

  // Fill to 3 with generic
  const shuffled = GENERIC_STARTERS.sort(() => Math.random() - 0.5);
  while (starters.length < 3) {
    starters.push(shuffled[starters.length] || GENERIC_STARTERS[0]);
  }

  return starters.slice(0, 3);
}

const SmartConversationStarters = ({ sharedInterests, matchName, onSelect }: SmartConversationStartersProps) => {
  const [starters, setStarters] = useState(() => generateStarters(sharedInterests, matchName));

  const refresh = () => {
    setStarters(generateStarters(sharedInterests, matchName));
  };

  return (
    <div className="rounded-2xl bg-muted/50 p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          Conversation Starters
        </p>
        <button onClick={refresh} className="p-1 rounded-full hover:bg-muted">
          <RefreshCw className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-1.5">
        {starters.map((s, i) => (
          <motion.button
            key={`${s}-${i}`}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect(s)}
            className="w-full text-left text-xs px-3 py-2 rounded-xl bg-card hover:bg-primary/10 text-foreground transition-colors border border-border"
          >
            {s}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SmartConversationStarters;
