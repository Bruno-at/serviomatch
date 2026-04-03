import { useState, useCallback } from "react";
import { motion, type PanInfo, AnimatePresence } from "framer-motion";
import {
  Heart, X, MapPin, BadgeCheck, MessageCircle, Star, Bookmark,
  Flame, Hand, Zap, MessageSquareHeart, HeartHandshake, Share2,
  ShieldAlert, Play, Mic
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile } from "@/data/profiles";
import VoiceIntroPlayer from "./VoiceIntroPlayer";

interface ProfileCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSuperLike?: () => void;
  onFavorite?: () => void;
  onBookmark?: () => void;
  onWave?: () => void;
  onBoost?: () => void;
  onCompliment?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onCompatibility?: () => void;
  onSecretCrush?: () => void;
  isTop: boolean;
}

const COMPLIMENTS = [
  "You have a great smile 😊",
  "I'd like to know you more 💫",
  "You seem really interesting ✨",
  "Love your vibe! 🌟",
  "Great taste in interests! 🎯",
];

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  className = "",
  iconClassName = "",
  size = "sm",
}: {
  icon: typeof Heart;
  label: string;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md" | "lg";
}) => {
  const sizeMap = { sm: "h-10 w-10", md: "h-12 w-12", lg: "h-14 w-14" };
  const iconSizeMap = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileTap={{ scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            onClick={onClick}
            className={`flex items-center justify-center rounded-full transition-all ${sizeMap[size]} ${className}`}
          >
            <Icon className={`${iconSizeMap[size]} ${iconClassName}`} />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ProfileCard = ({
  profile, onSwipeLeft, onSwipeRight, onSuperLike, onFavorite, onBookmark,
  onWave, onBoost, onCompliment, onShare, onReport, onCompatibility, onSecretCrush, isTop,
}: ProfileCardProps) => {
  const [showCompliments, setShowCompliments] = useState(false);
  const [swipeOverlay, setSwipeOverlay] = useState<"like" | "pass" | "super" | "save" | null>(null);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setSwipeOverlay(null);
    if (info.offset.x > 120) onSwipeRight();
    else if (info.offset.x < -120) onSwipeLeft();
    else if (info.offset.y < -120 && onSuperLike) onSuperLike();
    else if (info.offset.y > 120 && onBookmark) onBookmark();
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 60) setSwipeOverlay("like");
    else if (info.offset.x < -60) setSwipeOverlay("pass");
    else if (info.offset.y < -60) setSwipeOverlay("super");
    else if (info.offset.y > 60) setSwipeOverlay("save");
    else setSwipeOverlay(null);
  };

  return (
    <motion.div
      className="absolute inset-0"
      drag={isTop ? true : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.7 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.7 }}
      exit={{ x: 300, opacity: 0, rotate: 15, transition: { duration: 0.3 } }}
      whileDrag={{ cursor: "grabbing" }}
      style={{ zIndex: isTop ? 10 : 5 }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-elevated bg-card">
        <img src={profile.image} alt={profile.name} className="h-[55%] w-full object-cover" />
        <div className="absolute inset-0 h-[55%] bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />

        {/* Swipe overlay indicators */}
        <AnimatePresence>
          {swipeOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 z-30 flex items-center justify-center rounded-3xl ${
                swipeOverlay === "like" ? "bg-green-500/20 border-4 border-green-500" :
                swipeOverlay === "pass" ? "bg-destructive/20 border-4 border-destructive" :
                swipeOverlay === "super" ? "bg-blue-500/20 border-4 border-blue-500" :
                "bg-accent/20 border-4 border-accent"
              }`}
            >
              <span className="text-4xl font-black rotate-[-15deg] uppercase tracking-wider">
                {swipeOverlay === "like" && "❤️ LIKE"}
                {swipeOverlay === "pass" && "✖️ NOPE"}
                {swipeOverlay === "super" && "🔥 SUPER"}
                {swipeOverlay === "save" && "🔖 SAVE"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
          <span className="rounded-full bg-card/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {profile.distance}
          </span>
          <div className="flex items-center gap-2">
            {profile.verified && (
              <span className="rounded-full gradient-love px-3 py-1 text-xs font-medium text-primary-foreground flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
        </div>

        {/* Quick actions - top right */}
        {isTop && (
          <div className="absolute top-14 right-3 flex flex-col gap-2 z-20">
            {onBookmark && (
              <ActionButton icon={Bookmark} label="Save for later" onClick={onBookmark}
                className="bg-card/80 backdrop-blur-sm border border-border/50" iconClassName="text-accent" />
            )}
            {onShare && (
              <ActionButton icon={Share2} label="Share profile" onClick={onShare}
                className="bg-card/80 backdrop-blur-sm border border-border/50" iconClassName="text-muted-foreground" />
            )}
            {onReport && (
              <ActionButton icon={ShieldAlert} label="Report or block" onClick={onReport}
                className="bg-card/80 backdrop-blur-sm border border-border/50" iconClassName="text-muted-foreground" />
            )}
          </div>
        )}

        {/* Profile info */}
        <div className="absolute top-[45%] left-0 right-0 px-6 z-10">
          <h2 className="text-3xl font-bold text-primary-foreground font-display">
            {profile.name}, {profile.age}
          </h2>
          <p className="text-primary-foreground/80 text-sm mt-1">{profile.bio}</p>
        </div>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-card px-4 pt-3 pb-4 flex flex-col justify-between">
          <div className="flex flex-wrap gap-1.5 items-center">
            {(profile as any).voice_intro_url && (
              <VoiceIntroPlayer voiceUrl={(profile as any).voice_intro_url} size="sm" />
            )}
            {profile.interests.slice(0, 5).map((interest) => (
              <span key={interest} className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {interest}
              </span>
            ))}
          </div>

          {profile.prompts[0] && (
            <div className="mt-2 rounded-2xl bg-muted p-2.5">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {profile.prompts[0].question}
              </p>
              <p className="text-xs text-foreground mt-0.5 font-body">{profile.prompts[0].answer}</p>
            </div>
          )}

          {/* Compliment picker */}
          <AnimatePresence>
            {showCompliments && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-28 left-4 right-4 bg-card rounded-2xl border border-border shadow-elevated p-3 z-20"
              >
                <p className="text-xs font-semibold text-foreground mb-2">Send a compliment</p>
                <div className="flex flex-col gap-1.5">
                  {COMPLIMENTS.map((c) => (
                    <button key={c} onClick={() => { onCompliment?.(); setShowCompliments(false); }}
                      className="text-left text-xs px-3 py-2 rounded-xl bg-muted hover:bg-primary/10 text-foreground transition-colors"
                    >{c}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          {isTop && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <ActionButton icon={X} label="Pass" onClick={onSwipeLeft}
                className="border-2 border-destructive/30 bg-card hover:bg-destructive/10" iconClassName="text-destructive" size="lg" />
              {onWave && <ActionButton icon={Hand} label="Send a wave 👋" onClick={onWave}
                className="border-2 border-accent/30 bg-card hover:bg-accent/10" iconClassName="text-accent" />}
              {onFavorite && <ActionButton icon={Star} label="Add to favorites" onClick={onFavorite}
                className="border-2 border-yellow-400/30 bg-card hover:bg-yellow-400/10" iconClassName="text-yellow-500" />}
              <ActionButton icon={Heart} label="Like" onClick={onSwipeRight}
                className="gradient-love shadow-card" iconClassName="text-primary-foreground" size="lg" />
              {onSuperLike && <ActionButton icon={Flame} label="Super Like 🔥" onClick={onSuperLike}
                className="border-2 border-blue-400/30 bg-card hover:bg-blue-400/10" iconClassName="text-blue-500" />}
              {onCompliment && <ActionButton icon={MessageSquareHeart} label="Send compliment"
                onClick={() => setShowCompliments(!showCompliments)}
                className="border-2 border-pink-400/30 bg-card hover:bg-pink-400/10" iconClassName="text-pink-500" />}
              {onCompatibility && <ActionButton icon={HeartHandshake} label="Check compatibility" onClick={onCompatibility}
                className="border-2 border-primary/30 bg-card hover:bg-primary/10" iconClassName="text-primary" />}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileCard;
