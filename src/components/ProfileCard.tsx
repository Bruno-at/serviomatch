import { useState, useRef } from "react";
import { motion, type PanInfo, AnimatePresence } from "framer-motion";
import { Heart, X, MapPin, BadgeCheck, MessageSquareHeart, Hand, Undo2, MessageCircle, ChevronRight } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile } from "@/data/profiles";
import { countryFlag } from "@/data/profiles";

interface ProfileCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onWave?: () => void;
  onCompliment?: () => void;
  // legacy (still accepted but not rendered on card)
  onSuperLike?: () => void;
  onFavorite?: () => void;
  onBookmark?: () => void;
  onBoost?: () => void;
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
];

const ActionButton = ({
  icon: Icon, label, onClick, variant = "default", disabled = false,
}: {
  icon: typeof Heart;
  label: string;
  onClick: () => void;
  variant?: "default" | "pass" | "like" | "wave" | "compliment" | "undo";
  disabled?: boolean;
}) => {
  const sizeMap = {
    undo: "h-11 w-11",
    pass: "h-14 w-14",
    like: "h-14 w-14",
    wave: "h-14 w-14",
    compliment: "h-11 w-11",
    default: "h-12 w-12",
  };
  const iconSize = (variant === "pass" || variant === "like" || variant === "wave")
    ? "h-7 w-7" : "h-5 w-5";
  const colorMap = {
    undo: "text-amber-500",
    pass: "text-rose-500",
    like: "text-pink-500 fill-pink-500",
    wave: "text-amber-500",
    compliment: "text-sky-500",
    default: "text-foreground",
  };
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileTap={{ scale: disabled ? 1 : 0.85 }}
            whileHover={{ scale: disabled ? 1 : 1.08 }}
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.15)] ${sizeMap[variant]} ${disabled ? "opacity-40" : ""}`}
            aria-label={label}
          >
            <Icon className={`${iconSize} ${colorMap[variant]}`} strokeWidth={2.4} />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ProfileCard = ({
  profile, onSwipeLeft, onSwipeRight, onUndo, canUndo = false,
  onWave, onCompliment, isTop,
}: ProfileCardProps) => {
  const [showCompliments, setShowCompliments] = useState(false);
  const [swipeOverlay, setSwipeOverlay] = useState<"like" | "pass" | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const photos = (profile.photos && profile.photos.length > 0)
    ? profile.photos
    : (profile.image ? [profile.image] : []);

  const flag = countryFlag(profile.country) || countryFlag(profile.location?.split(",").pop()?.trim());

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setSwipeOverlay(null);
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    if (info.offset.x > 120) onSwipeRight();
    else if (info.offset.x < -120) onSwipeLeft();
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      setSwipeOverlay(null);
      return;
    }
    if (info.offset.x > 60) setSwipeOverlay("like");
    else if (info.offset.x < -60) setSwipeOverlay("pass");
    else setSwipeOverlay(null);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== photoIndex && idx >= 0 && idx < photos.length) {
      setPhotoIndex(idx);
    }
  };

  return (
    <motion.div
      className="absolute inset-0"
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.85}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.6 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.6 }}
      exit={{ x: 320, opacity: 0, rotate: 12, transition: { duration: 0.3 } }}
      whileDrag={{ cursor: "grabbing" }}
      style={{ zIndex: isTop ? 10 : 5 }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[28px] shadow-2xl bg-black">
        {/* Vertical scrollable photo stack */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-contain"
          style={{ scrollBehavior: "smooth" }}
        >
          {photos.map((photo, i) => (
            <div
              key={i}
              className="relative h-full w-full snap-start snap-always shrink-0"
            >
              <img
                src={photo}
                alt={`${profile.name} ${i + 1}`}
                className="h-full w-full object-cover select-none"
                draggable={false}
              />
            </div>
          ))}

          {/* Below-last-photo location panel */}
          {(profile.location || profile.distance) && (
            <div className="snap-start bg-black px-5 py-6 flex items-center gap-3 border-t border-white/5">
              <div className="h-11 w-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-base leading-tight">
                  📍 {profile.location || "Location"}
                </p>
                {profile.distance && (
                  <p className="text-white/60 text-xs mt-0.5">({profile.distance})</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </div>
          )}
        </div>

        {/* Top gradient */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 via-black/20 to-transparent pointer-events-none z-[2]" />
        {/* Bottom gradient for actions */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-[2]" />

        {/* Photo position indicator (vertical bars, right side) */}
        {photos.length > 1 && (
          <div className="absolute top-4 right-3 z-20 flex flex-col gap-1.5">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all ${
                  i === photoIndex ? "h-6 bg-white" : "h-3 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {/* Top-left profile info */}
        <div className="absolute top-4 left-4 z-20 text-white max-w-[75%] space-y-2">
          <div className="flex items-center gap-2">
            {flag && (
              <span className="text-2xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{flag}</span>
            )}
            <h2
              className="text-2xl font-bold font-display leading-tight"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}
            >
              {profile.name}, {profile.age}
            </h2>
            {profile.verified && <BadgeCheck className="w-5 h-5 text-sky-400 fill-sky-400/20" />}
          </div>
          {profile.intent && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md shadow-md">
              <MessageCircle className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
              <span className="text-xs font-semibold text-gray-800">{profile.intent}</span>
            </div>
          )}
        </div>

        {/* Swipe overlay */}
        <AnimatePresence>
          {swipeOverlay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute z-30 top-24 ${swipeOverlay === "like" ? "left-6" : "right-6"} px-5 py-2 rounded-2xl border-4 ${
                swipeOverlay === "like"
                  ? "border-emerald-400 text-emerald-300 -rotate-12"
                  : "border-rose-400 text-rose-300 rotate-12"
              } bg-black/30 backdrop-blur-sm`}
            >
              <span className="text-3xl font-black tracking-wider">
                {swipeOverlay === "like" ? "LIKE" : "NOPE"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compliment picker */}
        <AnimatePresence>
          {showCompliments && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-28 left-4 right-4 z-30 bg-black/75 backdrop-blur-xl rounded-2xl border border-white/20 p-3"
            >
              <p className="text-xs font-semibold text-white mb-2">Send a compliment</p>
              <div className="flex flex-col gap-1.5">
                {COMPLIMENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => { onCompliment?.(); setShowCompliments(false); }}
                    className="text-left text-xs px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating action row: Undo · Pass · Like · Wave · Compliment */}
        {isTop && (
          <div className="absolute bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-3 px-4">
            <ActionButton icon={Undo2} label="Undo" variant="undo" disabled={!canUndo} onClick={() => onUndo?.()} />
            <ActionButton icon={X} label="Pass" variant="pass" onClick={onSwipeLeft} />
            <ActionButton icon={Heart} label="Like" variant="like" onClick={onSwipeRight} />
            <ActionButton icon={Hand} label="Wave" variant="wave" onClick={() => onWave?.()} />
            <ActionButton icon={MessageSquareHeart} label="Compliment" variant="compliment" onClick={() => setShowCompliments((s) => !s)} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
