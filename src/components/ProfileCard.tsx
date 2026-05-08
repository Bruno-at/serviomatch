import { useState } from "react";
import { motion, type PanInfo, AnimatePresence } from "framer-motion";
import { Heart, X, MapPin, BadgeCheck, MessageSquareHeart, HeartHandshake } from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile } from "@/data/profiles";

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
];

const GlassButton = ({
  icon: Icon, label, onClick, accent = "white", size = "md",
}: {
  icon: typeof Heart;
  label: string;
  onClick: () => void;
  accent?: "white" | "primary" | "danger" | "pink" | "blue";
  size?: "md" | "lg";
}) => {
  const sizeMap = { md: "h-12 w-12", lg: "h-16 w-16" };
  const iconSize = { md: "h-5 w-5", lg: "h-7 w-7" };
  const accentMap = {
    white: "text-white",
    primary: "text-white",
    danger: "text-rose-300",
    pink: "text-pink-300",
    blue: "text-sky-300",
  };
  const bgMap = {
    white: "bg-white/15",
    primary: "bg-gradient-to-br from-primary to-primary/80",
    danger: "bg-white/15",
    pink: "bg-white/15",
    blue: "bg-white/15",
  };
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.08 }}
            onClick={onClick}
            className={`flex items-center justify-center rounded-full backdrop-blur-xl border border-white/25 shadow-lg ${sizeMap[size]} ${bgMap[accent]}`}
          >
            <Icon className={`${iconSize[size]} ${accentMap[accent]}`} strokeWidth={2.4} />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ProfileCard = ({
  profile, onSwipeLeft, onSwipeRight, onCompliment, onCompatibility, isTop,
}: ProfileCardProps) => {
  const [showCompliments, setShowCompliments] = useState(false);
  const [swipeOverlay, setSwipeOverlay] = useState<"like" | "pass" | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = (profile.photos && profile.photos.length > 0)
    ? profile.photos
    : (profile.image ? [profile.image] : []);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setSwipeOverlay(null);
    if (info.offset.x > 120) onSwipeRight();
    else if (info.offset.x < -120) onSwipeLeft();
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 60) setSwipeOverlay("like");
    else if (info.offset.x < -60) setSwipeOverlay("pass");
    else setSwipeOverlay(null);
  };

  const handleTapZone = (e: React.MouseEvent<HTMLDivElement>) => {
    if (photos.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      setPhotoIndex((i) => (i - 1 + photos.length) % photos.length);
    } else {
      setPhotoIndex((i) => (i + 1) % photos.length);
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
        {/* Edge-to-edge photo */}
        {photos[photoIndex] && (
          <img
            src={photos[photoIndex]}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover select-none"
            draggable={false}
          />
        )}

        {/* Tap zones for next/prev photo */}
        {isTop && photos.length > 1 && (
          <div className="absolute inset-0 z-[5]" onClick={handleTapZone} />
        )}

        {/* Top gradient for indicators / bottom gradient for info */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />

        {/* Photo indicators */}
        {photos.length > 1 && (
          <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
            {photos.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i === photoIndex ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        )}

        {/* Swipe overlay */}
        <AnimatePresence>
          {swipeOverlay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute z-30 top-10 ${swipeOverlay === "like" ? "left-6" : "right-6"} px-5 py-2 rounded-2xl border-4 ${
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

        {/* Verified badge top-right */}
        {profile.verified && (
          <div className="absolute top-7 right-4 z-20 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-2.5 py-1 flex items-center gap-1">
            <BadgeCheck className="w-3.5 h-3.5 text-sky-300" />
            <span className="text-[10px] font-semibold text-white">Verified</span>
          </div>
        )}

        {/* Profile info — bottom left, above actions */}
        <div className="absolute left-5 right-5 bottom-28 z-10 text-white">
          <h2
            className="text-3xl font-bold font-display leading-tight"
            style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
          >
            {profile.name}, {profile.age}
          </h2>
          {(profile.location || profile.distance) && (
            <div className="mt-1.5 flex items-center gap-1.5 text-white/90">
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-xs font-medium" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
                {profile.location ? `${profile.location}` : ""}
                {profile.location && profile.distance ? ` · ${profile.distance}` : profile.distance}
              </span>
            </div>
          )}
          {profile.bio && (
            <p
              className="mt-2 text-sm text-white/85 line-clamp-2"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
            >
              {profile.bio}
            </p>
          )}
          {profile.interests.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 4).map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-2.5 py-0.5 text-[10px] font-medium text-white"
                >
                  {i}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Compliment picker */}
        <AnimatePresence>
          {showCompliments && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-24 left-4 right-4 z-30 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/20 p-3"
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

        {/* Floating glass action buttons */}
        {isTop && (
          <div className="absolute bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-3 px-5">
            <GlassButton icon={X} label="Pass" onClick={onSwipeLeft} accent="danger" />
            {onCompliment && (
              <GlassButton
                icon={MessageSquareHeart}
                label="Send compliment"
                onClick={() => setShowCompliments((s) => !s)}
                accent="pink"
              />
            )}
            <GlassButton icon={Heart} label="Like" onClick={onSwipeRight} accent="primary" size="lg" />
            {onCompatibility && (
              <GlassButton
                icon={HeartHandshake}
                label="Check compatibility"
                onClick={onCompatibility}
                accent="blue"
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
