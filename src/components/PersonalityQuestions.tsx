import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const PERSONALITY_QUESTIONS = [
  { id: "drink", question: "Coffee or Tea?", options: ["Coffee ☕", "Tea 🍵"] },
  { id: "place", question: "Beach or Mountains?", options: ["Beach 🏖️", "Mountains ⛰️"] },
  { id: "social", question: "Introvert or Extrovert?", options: ["Introvert 🌙", "Extrovert ☀️"] },
  { id: "pet", question: "Dogs or Cats?", options: ["Dogs 🐶", "Cats 🐱"] },
  { id: "time", question: "Early Bird or Night Owl?", options: ["Early Bird 🌅", "Night Owl 🦉"] },
  { id: "food", question: "Sweet or Savory?", options: ["Sweet 🍰", "Savory 🍕"] },
  { id: "weekend", question: "Stay In or Go Out?", options: ["Stay In 🏠", "Go Out 🎉"] },
  { id: "music", question: "Pop or Afrobeats?", options: ["Pop 🎵", "Afrobeats 🥁"] },
] as const;

export type PersonalityAnswers = Record<string, string>;

interface PersonalityQuestionsProps {
  answers: PersonalityAnswers;
  onSave: (answers: PersonalityAnswers) => void;
}

const PersonalityQuestions = ({ answers: initial, onSave }: PersonalityQuestionsProps) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<PersonalityAnswers>(initial);
  const [saving, setSaving] = useState(false);

  const handleSelect = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ personality_answers: answers } as any)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save answers");
    } else {
      toast.success("Personality saved! ✨");
      onSave(answers);
    }
    setSaving(false);
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Personality Questions ({answeredCount}/{PERSONALITY_QUESTIONS.length})
      </label>

      <div className="space-y-3">
        {PERSONALITY_QUESTIONS.map((q) => (
          <div key={q.id} className="rounded-xl bg-muted p-3">
            <p className="text-xs font-medium text-foreground mb-2">{q.question}</p>
            <div className="flex gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt;
                return (
                  <motion.button
                    key={opt}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelect(q.id, opt)}
                    className={`flex-1 rounded-lg py-2 px-3 text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                      selected
                        ? "gradient-love text-primary-foreground shadow-card"
                        : "bg-card text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                    {opt}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saving || answeredCount === 0}
        className="mt-4 w-full rounded-xl gradient-love py-2.5 text-xs font-semibold text-primary-foreground shadow-card disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Answers"}
      </motion.button>
    </div>
  );
};

export default PersonalityQuestions;

// Utility: compute compatibility score
export function computeCompatibility(
  myProfile: { interests: string[] | null; personality_answers: PersonalityAnswers | null },
  theirProfile: { interests: string[] | null; personality_answers: PersonalityAnswers | null }
): { score: number; sharedInterests: string[]; matchedQuestions: string[] } {
  const myInterests = myProfile.interests || [];
  const theirInterests = theirProfile.interests || [];
  const sharedInterests = myInterests.filter((i) => theirInterests.includes(i));
  const totalInterests = new Set([...myInterests, ...theirInterests]).size;

  const myAnswers = myProfile.personality_answers || {};
  const theirAnswers = theirProfile.personality_answers || {};
  const allQuestionIds = new Set([...Object.keys(myAnswers), ...Object.keys(theirAnswers)]);
  const matchedQuestions: string[] = [];
  let commonQuestions = 0;

  allQuestionIds.forEach((id) => {
    if (myAnswers[id] && theirAnswers[id]) {
      commonQuestions++;
      if (myAnswers[id] === theirAnswers[id]) {
        matchedQuestions.push(
          PERSONALITY_QUESTIONS.find((q) => q.id === id)?.question || id
        );
      }
    }
  });

  // 50% weight interests, 50% weight personality
  const interestScore = totalInterests > 0 ? (sharedInterests.length / totalInterests) * 100 : 50;
  const personalityScore = commonQuestions > 0 ? (matchedQuestions.length / commonQuestions) * 100 : 50;
  const score = Math.round(interestScore * 0.5 + personalityScore * 0.5);

  return { score: Math.min(score, 100), sharedInterests, matchedQuestions };
}
