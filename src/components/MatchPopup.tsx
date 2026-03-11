import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, X } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface MatchPopupProps {
  open: boolean;
  myPhoto?: string | null;
  myName: string;
  matchPhoto?: string | null;
  matchName: string;
  onChat: () => void;
  onClose: () => void;
}

const MatchPopup = ({ open, myPhoto, myName, matchPhoto, matchName, onChat, onClose }: MatchPopupProps) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/60 backdrop-blur-sm px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-elevated text-center"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 rounded-full bg-muted p-1.5 hover:bg-muted/80 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Hearts animation */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mx-auto mb-4 rounded-full gradient-love p-4 w-fit"
            >
              <Heart className="h-8 w-8 text-primary-foreground fill-primary-foreground" />
            </motion.div>

            <h2 className="text-2xl font-bold font-display text-foreground mb-1">
              It's a Match! 🎉
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              You and {matchName} liked each other
            </p>

            {/* Profile photos */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <motion.div
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="rounded-full p-0.5 gradient-love">
                  <Avatar className="h-20 w-20 border-3 border-card">
                    <AvatarImage src={myPhoto || ""} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-bold text-2xl">
                      {myName[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-xs font-medium text-foreground mt-1.5">You</p>
              </motion.div>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
              >
                <Heart className="h-6 w-6 text-primary fill-primary" />
              </motion.div>

              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="rounded-full p-0.5 gradient-love">
                  <Avatar className="h-20 w-20 border-3 border-card">
                    <AvatarImage src={matchPhoto || ""} />
                    <AvatarFallback className="bg-muted text-muted-foreground font-bold text-2xl">
                      {matchName[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <p className="text-xs font-medium text-foreground mt-1.5">{matchName}</p>
              </motion.div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onChat}
                className="w-full rounded-2xl gradient-love py-3 text-sm font-semibold text-primary-foreground shadow-card flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Send a Message
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full rounded-2xl bg-muted py-3 text-sm font-medium text-muted-foreground"
              >
                Keep Swiping
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MatchPopup;
