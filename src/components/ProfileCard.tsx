import { useState, useRef } from "react";
import { motion, type PanInfo, AnimatePresence } from "framer-motion";
import {
  Heart, X, MapPin, BadgeCheck, MessageSquareHeart, Undo2, Sparkles,
  Briefcase, GraduationCap, Languages as LangIcon, Church, PawPrint, Baby,
  Cigarette, Wine, Dumbbell, Apple, HeartHandshake, Moon, Ruler, Globe2,
  Star, Brain, ShieldCheck,
} from "lucide-react";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Profile, ProfileDetails } from "@/data/profiles";
import { countryFlag } from "@/data/profiles";

interface ProfileCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onWave?: () => void;
  onCompliment?: () => void;
  onCompatibility?: () => void;
  // legacy (accepted but unused)
  onSuperLike?: () => void;
  onFavorite?: () => void;
  onBookmark?: () => void;
  onBoost?: () => void;
  onShare?: () => void;
  onReport?: () => void;
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
  variant?: "default" | "pass" | "like" | "compat" | "compliment" | "undo";
  disabled?: boolean;
}) => {
  const sizeMap: Record<string, string> = {
    undo: "h-11 w-11",
    pass: "h-14 w-14",
    like: "h-14 w-14",
    compat: "h-12 w-12",
    compliment: "h-11 w-11",
    default: "h-12 w-12",
  };
  const iconSize = (variant === "pass" || variant === "like") ? "h-7 w-7" : "h-5 w-5";
  const colorMap: Record<string, string> = {
    undo: "text-amber-300",
    pass: "text-rose-400",
    like: "text-pink-400 fill-pink-400",
    compat: "text-violet-300",
    compliment: "text-sky-300",
    default: "text-white",
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
            className={`flex items-center justify-center rounded-full bg-black/55 backdrop-blur-xl border border-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${sizeMap[variant]} ${disabled ? "opacity-40" : ""}`}
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

// ---------- Story sections ----------

const SectionShell = ({ children }: { children: React.ReactNode }) => (
  <div className="snap-start min-h-full w-full bg-black px-5 py-8 flex flex-col">
    <div className="rounded-3xl bg-white/[0.04] backdrop-blur-xl border border-white/10 p-5 space-y-4">
      {children}
    </div>
  </div>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">{children}</h3>
);

const InfoRow = ({
  icon: Icon, label, value,
}: { icon: typeof Heart; label: string; value: string | React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
    <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
      <Icon className="h-4 w-4 text-pink-300" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{label}</p>
      <p className="text-sm text-white font-medium mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-white">
    {children}
  </span>
);

const INTEREST_EMOJI: Record<string, string> = {
  Music: "🎵", Travel: "✈️", Football: "⚽", Gym: "🏋️", Reading: "📚",
  Food: "🍕", Gaming: "🎮", Photography: "📷", Technology: "💻",
  Volunteering: "❤️", Art: "🎨", Dancing: "💃", Film: "🎬", Yoga: "🧘",
  Hiking: "🥾", Cooking: "👨‍🍳", Coffee: "☕", Fitness: "💪", Tech: "💻", Dogs: "🐶",
};

const AboutMeCard = ({ profile, d }: { profile: Profile; d: ProfileDetails }) => {
  const hasAny = profile.bio || d.occupation || d.education || d.city || (d.languages?.length ?? 0) > 0 || profile.country;
  if (!hasAny) return null;
  const locationLabel = [d.city, profile.country].filter(Boolean).join(", ") || profile.location;
  return (
    <SectionShell>
      <SectionHeading>About Me</SectionHeading>
      {profile.bio && (
        <p className="text-[15px] leading-relaxed text-white/90 italic">"{profile.bio}"</p>
      )}
      <div>
        {d.occupation && <InfoRow icon={Briefcase} label="Occupation" value={d.occupation} />}
        {d.education && <InfoRow icon={GraduationCap} label="Education" value={d.education} />}
        {locationLabel && <InfoRow icon={MapPin} label="Location" value={locationLabel} />}
        {(d.languages?.length ?? 0) > 0 && (
          <InfoRow icon={LangIcon} label="Languages" value={d.languages!.join(", ")} />
        )}
      </div>
    </SectionShell>
  );
};

const InterestsCard = ({ profile }: { profile: Profile }) => {
  if (!profile.interests || profile.interests.length === 0) return null;
  return (
    <SectionShell>
      <SectionHeading>Interests</SectionHeading>
      <div className="flex flex-wrap gap-2 pt-1">
        {profile.interests.map((i) => (
          <Chip key={i}>
            <span>{INTEREST_EMOJI[i] || "✨"}</span>
            <span>{i}</span>
          </Chip>
        ))}
      </div>
    </SectionShell>
  );
};

const LifestyleCard = ({ d }: { d: ProfileDetails }) => {
  const items: Array<[typeof Heart, string, string | undefined | null]> = [
    [Church, "Religion", d.religion],
    [PawPrint, "Pets", d.pets?.join(", ")],
    [Baby, "Children", d.children],
    [Cigarette, "Smoking", d.smoking],
    [Wine, "Drinking", d.drinking],
    [Dumbbell, "Exercise", d.fitness],
    [Apple, "Diet", d.diet],
    [HeartHandshake, "Relationship Status", d.relationship_status],
    [Sparkles, "Goal", d.goal],
    [Moon, "Sleep Schedule", d.sleep_schedule],
  ];
  const filled = items.filter(([, , v]) => v && String(v).trim().length > 0);
  if (filled.length === 0) return null;
  return (
    <SectionShell>
      <SectionHeading>Lifestyle</SectionHeading>
      <div>
        {filled.map(([Icon, label, value]) => (
          <InfoRow key={label} icon={Icon} label={label} value={value as string} />
        ))}
      </div>
    </SectionShell>
  );
};

const PersonalityCard = ({ profile, d }: { profile: Profile; d: ProfileDetails }) => {
  const items: Array<[typeof Heart, string, string | undefined | null]> = [
    [Brain, "Personality", d.personality_traits?.join(", ")],
    [Star, "Star Sign", d.star_sign],
    [Ruler, "Height", d.height_cm ? `${d.height_cm} cm` : null],
    [Globe2, "Ethnicity", d.ethnicity],
  ];
  const filled = items.filter(([, , v]) => v && String(v).trim().length > 0);
  if (filled.length === 0) return null;
  return (
    <SectionShell>
      <SectionHeading>More Info</SectionHeading>
      <div>
        {filled.map(([Icon, label, value]) => (
          <InfoRow key={label} icon={Icon} label={label} value={value as string} />
        ))}
      </div>
    </SectionShell>
  );
};

const VerificationCard = ({ profile, d }: { profile: Profile; d: ProfileDetails }) => (
  <SectionShell>
    <div className="flex flex-col items-center text-center py-4 space-y-4">
      <div className="relative">
        <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
          {d.avatar_url || profile.image ? (
            <img src={d.avatar_url || profile.image} alt={profile.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-white/10" />
          )}
        </div>
        {profile.verified && (
          <div className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-emerald-500 border-4 border-black flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" strokeWidth={3} />
          </div>
        )}
      </div>
      <div>
        <h3 className="text-lg font-bold font-display text-white">
          {profile.verified ? "Photo Verified" : "Not Verified Yet"}
        </h3>
        <p className="text-sm text-white/70 mt-1.5 max-w-[260px] mx-auto">
          {profile.verified
            ? "✅ This person's identity has been verified."
            : "This profile hasn't been verified yet."}
        </p>
      </div>
    </div>
  </SectionShell>
);

// Photo section
const PhotoSection = ({
  src, alt, isFirst, header,
}: { src: string; alt: string; isFirst: boolean; header?: React.ReactNode }) => (
  <div className="relative snap-start h-full w-full shrink-0">
    <img src={src} alt={alt} className="h-full w-full object-cover select-none" draggable={false} loading={isFirst ? "eager" : "lazy"} />
    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
    {isFirst && header && (
      <>
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/70 via-black/20 to-transparent pointer-events-none" />
        {header}
      </>
    )}
  </div>
);

// ----------- Main card -----------

const ProfileCard = ({
  profile, onSwipeLeft, onSwipeRight, onUndo, canUndo = false,
  onCompliment, onCompatibility, isTop,
}: ProfileCardProps) => {
  const [showCompliments, setShowCompliments] = useState(false);
  const [swipeOverlay, setSwipeOverlay] = useState<"like" | "pass" | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const photos = (profile.photos && profile.photos.length > 0)
    ? profile.photos
    : (profile.image ? [profile.image] : []);
  const d = profile.details || {};
  const flag = countryFlag(profile.country) || countryFlag(profile.location?.split(",").pop()?.trim());

  // Build alternating sections list
  const cards: Array<{ key: string; node: React.ReactNode }> = [];
  const aboutMe = <AboutMeCard profile={profile} d={d} />;
  const interests = <InterestsCard profile={profile} />;
  const lifestyle = <LifestyleCard d={d} />;
  const personality = <PersonalityCard profile={profile} d={d} />;
  const verification = <VerificationCard profile={profile} d={d} />;
  [
    { key: "about", node: aboutMe },
    { key: "interests", node: interests },
    { key: "lifestyle", node: lifestyle },
    { key: "personality", node: personality },
  ].forEach((c) => { if (c.node) cards.push(c); });

  // Hero header overlay (only over first photo)
  const heroHeader = (
    <div className="absolute top-4 left-4 right-4 z-20 text-white space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
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
          <span className="text-xs font-semibold text-gray-800">{profile.intent}</span>
        </div>
      )}
      {(profile.location || profile.country) && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 ml-2">
          {flag && <span className="text-sm leading-none">{flag}</span>}
          <MapPin className="h-3 w-3 text-white/80" />
          <span className="text-[11px] font-medium text-white">
            {[d.city, profile.country].filter(Boolean).join(", ") || profile.location}
          </span>
          {profile.distance && profile.distance !== "Nearby" && (
            <span className="text-[11px] text-white/70">· {profile.distance}</span>
          )}
        </div>
      )}
    </div>
  );

  // Build the full story sequence: alternating photo / card
  const story: React.ReactNode[] = [];
  const photoCount = photos.length;
  if (photoCount === 0) {
    cards.forEach((c) => story.push(<div key={c.key}>{c.node}</div>));
  } else {
    // First photo is hero
    story.push(
      <PhotoSection key="photo-0" src={photos[0]} alt={`${profile.name} 1`} isFirst header={heroHeader} />
    );
    let photoIdx = 1;
    let cardIdx = 0;
    // Alternate: card, photo, card, photo, ...
    while (cardIdx < cards.length || photoIdx < photoCount) {
      if (cardIdx < cards.length) {
        const c = cards[cardIdx++];
        story.push(<div key={c.key}>{c.node}</div>);
      }
      if (photoIdx < photoCount) {
        story.push(
          <PhotoSection
            key={`photo-${photoIdx}`}
            src={photos[photoIdx]}
            alt={`${profile.name} ${photoIdx + 1}`}
            isFirst={false}
          />
        );
        photoIdx++;
      }
    }
  }
  // Final verification card
  story.push(<div key="verify">{verification}</div>);

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
    // Track which photo (top of viewport) is currently in view among photos only
    const idx = Math.min(photoCount - 1, Math.max(0, Math.round(el.scrollTop / el.clientHeight)));
    if (idx !== photoIndex) setPhotoIndex(idx);
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
        {/* Vertical scrollable story */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-contain"
          style={{ scrollBehavior: "smooth" }}
        >
          {story}
        </div>

        {/* Photo position indicator (top right, only counts photos) */}
        {photoCount > 1 && (
          <div className="absolute top-4 right-3 z-20 flex flex-col gap-1.5 pointer-events-none">
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
              } bg-black/30 backdrop-blur-sm pointer-events-none`}
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

        {/* Floating glass action row */}
        {isTop && (
          <div className="absolute bottom-5 left-0 right-0 z-20 flex items-center justify-center gap-2.5 px-4 pointer-events-none">
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <ActionButton icon={Undo2} label="Undo" variant="undo" disabled={!canUndo} onClick={() => onUndo?.()} />
              <ActionButton icon={X} label="Pass" variant="pass" onClick={onSwipeLeft} />
              <ActionButton icon={Heart} label="Like" variant="like" onClick={onSwipeRight} />
              <ActionButton icon={Sparkles} label="Check Compatibility" variant="compat" onClick={() => onCompatibility?.()} />
              <ActionButton icon={MessageSquareHeart} label="Compliment" variant="compliment" onClick={() => setShowCompliments((s) => !s)} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ProfileCard;
