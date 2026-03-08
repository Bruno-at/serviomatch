import { motion, type PanInfo } from "framer-motion";
import { Heart, X, MapPin, BadgeCheck, MessageCircle } from "lucide-react";
import type { Profile } from "@/data/profiles";

interface ProfileCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isTop: boolean;
}

const ProfileCard = ({ profile, onSwipeLeft, onSwipeRight, isTop }: ProfileCardProps) => {
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 120) onSwipeRight();
    else if (info.offset.x < -120) onSwipeLeft();
  };

  return (
    <motion.div
      className="absolute inset-0"
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      initial={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.7 }}
      animate={{ scale: isTop ? 1 : 0.95, opacity: isTop ? 1 : 0.7 }}
      exit={{ x: 300, opacity: 0, rotate: 15, transition: { duration: 0.3 } }}
      whileDrag={{ cursor: "grabbing" }}
      style={{ zIndex: isTop ? 10 : 5 }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-elevated bg-card">
        <img
          src={profile.image}
          alt={profile.name}
          className="h-[65%] w-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 h-[65%] bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />

        {/* Top badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
          <span className="rounded-full bg-card/80 backdrop-blur-sm px-3 py-1 text-xs font-medium text-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {profile.distance}
          </span>
          {profile.verified && (
            <span className="rounded-full gradient-love px-3 py-1 text-xs font-medium text-primary-foreground flex items-center gap-1">
              <BadgeCheck className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>

        {/* Profile info */}
        <div className="absolute top-[55%] left-0 right-0 px-6">
          <h2 className="text-3xl font-bold text-primary-foreground font-display">
            {profile.name}, {profile.age}
          </h2>
          <p className="text-primary-foreground/80 text-sm mt-1">{profile.bio}</p>
        </div>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-card px-6 pt-4 pb-6 flex flex-col justify-between">
          {/* Interests */}
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {interest}
              </span>
            ))}
          </div>

          {/* Prompt */}
          {profile.prompts[0] && (
            <div className="mt-3 rounded-2xl bg-muted p-3">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {profile.prompts[0].question}
              </p>
              <p className="text-sm text-foreground mt-1 font-body">
                {profile.prompts[0].answer}
              </p>
            </div>
          )}

          {/* Action buttons */}
          {isTop && (
            <div className="flex justify-center gap-6 mt-4">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onSwipeLeft}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/30 bg-card transition-colors hover:bg-destructive/10"
              >
                <X className="h-6 w-6 text-destructive" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onSwipeRight}
                className="flex h-14 w-14 items-center justify-center rounded-full gradient-love shadow-card"
              >
                <Heart className="h-6 w-6 text-primary-foreground" />
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileCard;
