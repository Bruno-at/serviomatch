import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw } from "lucide-react";

const ICEBREAKERS = [
  "What's your dream travel destination? ✈️",
  "Pizza or burgers? 🍕🍔",
  "What's your favorite movie? 🎬",
  "Coffee or tea? ☕🍵",
  "What's your hidden talent? 🎯",
  "Beach vacation or mountain adventure? 🏖️⛰️",
  "Early bird or night owl? 🌅🦉",
  "What's the best concert you've been to? 🎶",
  "Cats or dogs? 🐱🐶",
  "What would you cook for a first date? 👨‍🍳",
  "What's your go-to karaoke song? 🎤",
  "If you could have any superpower? 🦸",
  "What's the last book you read? 📚",
  "Sweet or savory? 🍭🧀",
  "What's your favorite season? 🌸❄️",
  "What show are you binge-watching? 📺",
  "What's your love language? 💝",
  "Spontaneous or planner? 🎲📋",
  "What's your comfort food? 🍜",
  "Truth or dare? 😏",
];

interface IcebreakerQuestionsProps {
  sharedInterests?: string[];
  onSelect: (question: string) => void;
}

const IcebreakerQuestions = ({ sharedInterests, onSelect }: IcebreakerQuestionsProps) => {
  const [dismissed, setDismissed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const questions = useMemo(() => {
    // If shared interests, generate a custom one
    const pool = [...ICEBREAKERS];
    if (sharedInterests && sharedInterests.length > 0) {
      const shared = sharedInterests[Math.floor(Math.random() * sharedInterests.length)];
      pool.unshift(`I see you also love ${shared}! What got you into it? 🤩`);
    }
    // Pick 3 random
    const shuffled = pool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedInterests, refreshKey]);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-2 mb-3 rounded-2xl bg-accent/5 border border-accent/15 p-3"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs font-semibold text-foreground">Break the ice!</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="rounded-full p-1 hover:bg-muted transition-colors"
            >
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-[10px] text-muted-foreground hover:text-foreground px-1"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {questions.map((q, i) => (
            <motion.button
              key={`${refreshKey}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => {
                onSelect(q);
                setDismissed(true);
              }}
              className="text-left rounded-xl bg-card border border-border px-3 py-2 text-xs text-foreground hover:bg-primary/5 hover:border-primary/20 transition-colors"
            >
              {q}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IcebreakerQuestions;
