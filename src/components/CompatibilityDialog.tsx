import { motion } from "framer-motion";
import { HeartHandshake, X } from "lucide-react";

interface CompatibilityDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  score: number;
  sharedInterests: string[];
  matchedQuestions?: string[];
}

const CompatibilityDialog = ({ open, onClose, name, score, sharedInterests, matchedQuestions = [] }: CompatibilityDialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="bg-card rounded-3xl p-6 max-w-xs w-full shadow-elevated border border-border"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-bold text-foreground">Compatibility</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="relative w-28 h-28 mb-4">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-muted" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                strokeLinecap="round"
                className="stroke-primary"
                strokeDasharray={`${score * 2.64} ${264 - score * 2.64}`}
                initial={{ strokeDasharray: "0 264" }}
                animate={{ strokeDasharray: `${score * 2.64} ${264 - score * 2.64}` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-foreground font-display">{score}%</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center mb-3">
            You and <span className="font-semibold text-foreground">{name}</span> are a {score >= 70 ? "great" : score >= 40 ? "good" : "potential"} match!
          </p>

          {sharedInterests.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <HeartHandshake className="h-3 w-3" /> Shared interests
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sharedInterests.map((i) => (
                  <span key={i} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-medium">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CompatibilityDialog;
